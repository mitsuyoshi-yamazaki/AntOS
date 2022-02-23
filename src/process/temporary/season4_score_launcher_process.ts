import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { getHighwayRooms, Highway, RoomCoordinate, RoomName } from "utility/room_name"
import { MessageObserver } from "os/infrastructure/message_observer"
import { coloredResourceType, coloredText, describeTime, roomHistoryLink, roomLink } from "utility/log"
import { Timestamp } from "utility/timestamp"
import { Environment } from "utility/environment"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Season4ObserverManager } from "./season4_observer_manager"
import { Position } from "prototype/room_position"
import { directionDescription, GameConstants } from "utility/constants"
import { getCommodityTier, isCommodityConstant } from "utility/resource"
import { KeywordArguments } from "os/infrastructure/console_command/utility/keyword_argument_parser"
import { processLog } from "os/infrastructure/logger"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { ValuedArrayMap } from "utility/valued_collection"
import { OperatingSystem } from "os/os"
import { Season4784484ScoreProcess } from "./season4_784484_score_process"
import { getSeason4CommodityScore } from "utility/season4"
import { Season41076620ResourceManagerProcess } from "./season4_1076620_resource_manager_process"
import { ResourceManager } from "utility/resource_manager"
import { RoomResources } from "room_resource/room_resources"

ProcessDecoder.register("Season4ScoreLauncherProcess", state => {
  return Season4ScoreLauncherProcess.decode(state as Season4ScoreLauncherProcessState)
})

type ConvoyDirection = TOP | BOTTOM | LEFT | RIGHT
type HighwayDirection = "vertical" | "horizontal"

type FirstLookConvoyCreep = {
  readonly observedAt: Timestamp
  readonly commodityType: CommodityConstant
  readonly localPosition: Position
  readonly roomName: RoomName
}
type ConvoyCreepInfo = {
  readonly observedAt: Timestamp
  readonly commodityType: CommodityConstant
  readonly roomName: RoomName
  readonly direction: ConvoyDirection
  readonly estimatedDespawnTime: Timestamp
}

type ObserveLog = {
  readonly observedAt: Timestamp
  readonly commodityType: CommodityConstant
  readonly direction: ConvoyDirection | "unknown"
  readonly roomName: RoomName
}

type HighwayObservingInfo = {
  readonly observerRoomName: RoomName
  readonly scoreRoomName: RoomName
  readonly highwayEntranceRoomName: RoomName
  readonly scoreDirection: ConvoyDirection
  readonly highway: {
    readonly direction: HighwayDirection
    readonly startRoomName: RoomName
    readonly endRoomName: RoomName
  }
}

let resourceManagerProcessId = null as ProcessId | null
function getResourceManagerProcess(): Season41076620ResourceManagerProcess | null {
  if (resourceManagerProcessId != null) {
    const process = OperatingSystem.os.processOf(resourceManagerProcessId)
    if (process instanceof Season41076620ResourceManagerProcess) {
      return process
    }
  }
  resourceManagerProcessId = null

  for (const processInfo of OperatingSystem.os.listAllProcesses()) {
    if (processInfo.process instanceof Season41076620ResourceManagerProcess) {
      resourceManagerProcessId = processInfo.process.processId
      return processInfo.process
    }
  }
  return null
}

export interface Season4ScoreLauncherProcessState extends ProcessState {
  readonly observingHighways: HighwayObservingInfo[]
  readonly firstLookConvoyCreeps: { [creepId: string]: FirstLookConvoyCreep }
  readonly convoyCreeps: {[creepId: string]: ConvoyCreepInfo}
  readonly creepObserveLogs: ObserveLog[]
  readonly ignoreCreepIds: Id<Creep>[]
  readonly scoreableResources: CommodityConstant[]
  readonly options: {
    readonly launchScoreProcess: boolean
  }
}

export class Season4ScoreLauncherProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private observingHighways: HighwayObservingInfo[],
    private readonly firstLookConvoyCreeps: { [creepId: string]: FirstLookConvoyCreep },
    private readonly convoyCreeps: { [creepId: string]: ConvoyCreepInfo },
    private readonly creepObserveLogs: ObserveLog[],
    private ignoreCreepIds: Id<Creep>[],
    private scoreableResources: CommodityConstant[],
    private readonly options: {
      launchScoreProcess: boolean
    },
  ) {
    this.taskIdentifier = this.constructor.name

    observingHighways.forEach(highway => {
      this.addObserveRequest(highway)
    })
  }

  public encode(): Season4ScoreLauncherProcessState {
    return {
      t: "Season4ScoreLauncherProcess",
      l: this.launchTime,
      i: this.processId,
      observingHighways: this.observingHighways,
      firstLookConvoyCreeps: this.firstLookConvoyCreeps,
      convoyCreeps: this.convoyCreeps,
      creepObserveLogs: this.creepObserveLogs,
      ignoreCreepIds: this.ignoreCreepIds,
      scoreableResources: this.scoreableResources,
      options: this.options,
    }
  }

  public static decode(state: Season4ScoreLauncherProcessState): Season4ScoreLauncherProcess {
    return new Season4ScoreLauncherProcess(
      state.l,
      state.i,
      state.observingHighways,
      state.firstLookConvoyCreeps,
      state.convoyCreeps,
      state.creepObserveLogs,
      state.ignoreCreepIds,
      state.scoreableResources ?? [],
      state.options,
    )
  }

  public static create(processId: ProcessId): Season4ScoreLauncherProcess {
    return new Season4ScoreLauncherProcess(Game.time, processId, [], {}, {}, [], [], [], {launchScoreProcess: false})
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `observing ${this.observingHighways.length} highways`,
    ]
    if (this.options.launchScoreProcess !== true) {
      descriptions.push("no score process launch")
    }
    const lastObservedConvoy = this.lastObservedConvoy()
    if (lastObservedConvoy != null) {
      descriptions.push(`last convoy ${describeTime(lastObservedConvoy.ticksAgo)} ago in ${roomLink(lastObservedConvoy.roomName)}`)
    } else {
      descriptions.push("no convoy observed")
    }
    return descriptions.join(", ")
  }

  public processDescription(): string {
    const descriptions: string[] = [
      `observing ${this.observingHighways.length} highways`,
      `scoreable resources: ${this.scoreableResources.map(resourceType => coloredResourceType(resourceType)).join(",")}`,
    ]

    const commoditiesByDirection = (convoy: ConvoyCreepInfo[], roomName: RoomName): string => {
      const commoditiesByDirection = convoy.reduce((result, current) => {
        result.getValueFor(current.direction).push(current.commodityType)
        return result
      }, new ValuedArrayMap<ConvoyDirection, CommodityConstant>())

      const commodityDescription = Array.from(commoditiesByDirection.entries())
        .map(([direction, commodities]) => {
          const directionDescriptions: string[] = [
            `${directionDescription(direction)}: `,
            commodities.map(commodity => coloredResourceType(commodity)).join(","),
          ]
          return directionDescriptions.join("")
        })
        .join(", ")
      return `  - ${convoy.length} convoys in ${roomLink(roomName)}, ${commodityDescription}`
    }

    const allHighwayDescriptions = this.observingHighways.flatMap((highwayInfo): string[] => {
      const highway = highwayInfo.highway
      const highwayDescriptions: string[] = [
        `- highway ${roomLink(highway.startRoomName)} = ${roomLink(highway.endRoomName)}, observed from: ${roomLink(highwayInfo.observerRoomName)}, score: ${roomLink(highwayInfo.scoreRoomName)}, score direction ${directionDescription(highwayInfo.scoreDirection)}`
      ]
      const convoysInStartRoom = this.convoyCreepsOnHighway(highway.startRoomName)
      if (convoysInStartRoom.length > 0) {
        highwayDescriptions.push(commoditiesByDirection(convoysInStartRoom, highway.startRoomName))
      }
      const convoysInEndRoom = this.convoyCreepsOnHighway(highway.endRoomName)
      if (convoysInEndRoom.length > 0) {
        highwayDescriptions.push(commoditiesByDirection(convoysInEndRoom, highway.endRoomName))
      }

      return highwayDescriptions
    })
    descriptions.push(...allHighwayDescriptions)

    return descriptions.join("\n")
  }

  private lastObservedConvoy(): { roomName: RoomName, ticksAgo: Timestamp } | null {
    const observedConvoys = Array.from(Object.values(this.convoyCreeps))
    observedConvoys.sort((lhs, rhs) => {
      return rhs.observedAt - lhs.observedAt
    })
    const lastObservedConvoyInfo = observedConvoys[0]
    if (lastObservedConvoyInfo == null) {
      return null
    }
    return {
      roomName: lastObservedConvoyInfo.roomName,
      ticksAgo: Game.time - lastObservedConvoyInfo.observedAt,
    }
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "add_highway", "remove_highway", "show_convoy", "show_logs", "set_option", "launch_debugger", "launch_score_process", "add_scoreable_resources", "remove_scoreable_resource"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        return this.processDescription()

      case "add_highway":
        return this.addHighway(components)

      case "remove_highway":
        return this.removeHighway(components)

      case "show_convoy":
        return this.showConvoyOnHighway(components)

      case "show_logs":
        return this.showLogs()

      case "set_option":
        return this.setOption(components)

      case "launch_debugger":
        return this.launchDebugger(components)

      case "launch_score_process":
        return this.launchScoreProcessManually(components)

      case "add_scoreable_resources":
        return this.addScoreableResource(components)

      case "remove_scoreable_resource":
        return this.removeScoreableResource(components)

      default:
        throw `Invalid command ${command}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  /** @throws */
  private addScoreableResource(args: string[]): string {
    const listArguments = new ListArguments(args)
    const commodityType = listArguments.commodityType(0, "commodity type").parse()
    if (this.scoreableResources.includes(commodityType) === true) {
      throw `${coloredResourceType(commodityType)} is already in the list`
    }
    this.scoreableResources.push(commodityType)

    return `scoreable resource types: ${this.scoreableResources.map(resourceType => coloredResourceType(resourceType)).join(",")}`
  }

  /** @throws */
  private removeScoreableResource(args: string[]): string {
    const listArguments = new ListArguments(args)
    const commodityType = listArguments.string(0, "commodity type").parse()
    if (commodityType === "all") {
      this.scoreableResources = []
      return "removed all scoreable resource types"
    }
    if (!(isCommodityConstant(commodityType))) {
      throw `${commodityType} is not commodity constant`
    }
    const index = this.scoreableResources.indexOf(commodityType)
    if (index < 0) {
      throw `${coloredResourceType(commodityType)} is not in the list`
    }
    this.scoreableResources.splice(index, 1)
    return `removed ${coloredResourceType(commodityType)}, scoreable resource types: ${this.scoreableResources.map(resourceType => coloredResourceType(resourceType)).join(",")}`
  }

  /** @throws */
  private launchScoreProcessManually(args: string[]): string {
    const listArguments = new ListArguments(args)
    const commodityType = listArguments.commodityType(0, "commodity type").parse()
    const highwayRoomName = listArguments.roomName(1, "highway room name").parse()
    const amount = ((): number | "all" => {
      try {
        return listArguments.int(2, "resource amount").parse({ min: 1, max: 999 })
      } catch {
        const stringValue = listArguments.string(2, "resource amount").parse()
        if (stringValue === "all") {
          return stringValue
        }
        throw `2nd argument should be integer or "all" (${stringValue})`
      }
    })()

    const keywordArguments = new KeywordArguments(args)
    const specifiedonvoyCreepId = keywordArguments.gameObjectId("convoy_creep_id").parseOptional() as Id<Creep>

    const findResult = Array.from(Object.entries(this.convoyCreeps)).find(([convoyCreepId, convoyInfo]) => {
      if (convoyInfo.commodityType !== commodityType) {
        return false
      }
      if (convoyInfo.roomName !== highwayRoomName) {
        return false
      }
      if (specifiedonvoyCreepId != null) {
        if (convoyCreepId !== specifiedonvoyCreepId) {
          return false
        }
      }
      return true
    })
    if (findResult == null) {
      throw `no convoy observed (${coloredResourceType(commodityType)} in ${roomLink(highwayRoomName)})`
    }
    const [convoyCreepId, convoyInfo] = findResult

    const highwayResult = this.observingHighways
      .flatMap(highwayInfo => {
        return [
          { highwayInfo, observeRoomName: highwayInfo.highway.startRoomName },
          { highwayInfo, observeRoomName: highwayInfo.highway.endRoomName },
        ]
      })
      .find(info => {
        if (info.observeRoomName !== highwayRoomName) {
          return false
        }
        return true
      })
    if (highwayResult == null) {
      throw `no observing highway for ${roomLink(highwayRoomName)}`
    }
    const { highwayInfo } = highwayResult

    this.launchScoreProcess(convoyCreepId as Id<Creep>, convoyInfo, highwayInfo, {ignoreScoreableResource: true, amount})
    return "ok"
  }

  /** @throws */
  private launchDebugger(args: string[]): string {
    const listArguments = new ListArguments(args)
    const highwayStartRoomName = listArguments.roomName(0, "highway start room name").parse()
    const highway = this.observingHighways.find(observingHighway => observingHighway.highway.startRoomName === highwayStartRoomName)
    if (highway == null) {
      throw `no highway starts from ${roomLink(highwayStartRoomName)}`
    }

    OperatingSystem.os.addProcess(null, processId => {
      return Season4784484ScoreProcess.create(
        processId,
        highway.scoreRoomName,
        highway.highwayEntranceRoomName,
        highway.scoreDirection,
        RESOURCE_WIRE,
        10,
        "test" as Id<Creep>,
        500,
        {
          dryRun: true,
        },
      )
    })

    return `launched score-er from ${roomLink(highway.highwayEntranceRoomName)} to ${directionDescription(highway.scoreDirection)}`
  }

  /** @throws */
  private setOption(args: string[]): string {
    const listArguments = new ListArguments(args)
    const option = listArguments.string(0, "option").parse()

    switch (option) {
    case "launch_score_process": {
      const value = listArguments.boolean(1, "enabled").parse()
      const oldValue = this.options.launchScoreProcess
      this.options.launchScoreProcess = value
      return `launch_score_process set ${value} (from ${oldValue})`
    }

    default:
      throw `invalid option ${option}, options: launch_score_process`
    }
  }

  /** @throws */
  private showConvoyOnHighway(args: string[]): string {
    const listArguments = new ListArguments(args)
    const edgeRoomName = listArguments.roomName(0, "highway edge room name").parse()
    const convoyCreeps = this.convoyCreepsOnHighway(edgeRoomName)

    const results: string[] = [
      `${convoyCreeps.length} convoys observed`,
      ...convoyCreeps.map(convoyCreep => `- ${convoyCreepDescription(convoyCreep)}`),
    ]
    return results.join("\n")
  }

  private convoyCreepsOnHighway(highwayEdgeRoomName: RoomName): ConvoyCreepInfo[] {
    return Array.from(Object.values(this.convoyCreeps)).filter(convoyCreep => convoyCreep.roomName === highwayEdgeRoomName)
  }

  /** @throws */
  private removeHighway(args: string[]): string {
    const listArguments = new ListArguments(args)
    const removeArgument = ((): RoomName | "all" => {
      const arg = listArguments.string(0, "room name or all").parse()
      if (arg === "all") {
        return arg
      }
      return arg
    })()

    if (removeArgument === "all") {
      this.observingHighways = []
      return "removed all highways"
    }

    throw "not implemented yet"
  }

  /** @throws */
  private addHighway(args: string[]): string {
    const keywordArguments = new KeywordArguments(args)
    const observerRoomResource = keywordArguments.ownedRoomResource("observer_room_name").parse()
    const observerRoomName = observerRoomResource.room.name
    if (observerRoomResource.activeStructures.observer == null) {
      throw `${roomLink(observerRoomName)} has no observer`
    }

    const scoreRoomName = keywordArguments.roomName("score_room_name").parse({my: true})

    const highwayEntranceRoomCoordinate = keywordArguments.roomCoordinate("highway_entrance_room_name").parse()
    const highwayRoomCoordinate = ((): RoomCoordinate => {
      const optionalHighwayRoomCoordinate = keywordArguments.roomCoordinate("highway_room_name").parseOptional()
      if (optionalHighwayRoomCoordinate != null) {
        return optionalHighwayRoomCoordinate
      }
      return highwayEntranceRoomCoordinate
    })()
    const highwayRoomName = highwayRoomCoordinate.roomName
    const detailedCoordinate = highwayRoomCoordinate.detailedCoordinate()
    if (detailedCoordinate.case !== "highway") {
      throw `${roomLink(highwayRoomName)} is not on a highway (${detailedCoordinate.case})`
    }
    const targetHighway = detailedCoordinate.highway
    const highwayRoomNames = getHighwayRooms(targetHighway)
    const startRoomName = highwayRoomNames[0]
    const endRoomName = highwayRoomNames[highwayRoomNames.length - 1]

    if (startRoomName == null || endRoomName == null || startRoomName === endRoomName) {
      throw `Highway ${highwayDescription(targetHighway)} lack of rooms (${highwayRoomNames.map(r => roomLink(r)).join(",")})`
    }

    if (this.observingHighways.some(info => info.highway.startRoomName === startRoomName && info.highway.endRoomName === endRoomName) === true) {
      throw `Highway ${highwayDescription(targetHighway)} is already been observed`
    }

    const startRoomObserveDistance = Game.map.getRoomLinearDistance(observerRoomName, startRoomName)
    const endRoomObserveDistance = Game.map.getRoomLinearDistance(observerRoomName, endRoomName)
    if (startRoomObserveDistance > 10 || endRoomObserveDistance > 10) {
      throw `Highway ${highwayDescription(targetHighway)} is not in observer range. ${roomLink(observerRoomName)} =${startRoomObserveDistance}= ${roomLink(startRoomName)}, ${roomLink(observerRoomName)} =${endRoomObserveDistance}= ${roomLink(endRoomName)}`
    }

    const scoreDirection = keywordArguments.direction("score_direction").parse()
    if (scoreDirection !== TOP && scoreDirection !== BOTTOM && scoreDirection !== LEFT && scoreDirection !== RIGHT) {
      throw `${directionDescription(scoreDirection)} is not highway direction`
    }

    const targetHighwayInfo: HighwayObservingInfo = {
      observerRoomName,
      scoreRoomName,
      highwayEntranceRoomName: highwayEntranceRoomCoordinate.roomName,
      scoreDirection,
      highway: {
        direction: targetHighway.direction,
        startRoomName,
        endRoomName,
      },
    }
    this.addObserveRequest(targetHighwayInfo)
    this.observingHighways.push(targetHighwayInfo)
    return `Added ${highwayDescription(targetHighway)}`
  }

  private showLogs(): string {
    if (this.observingHighways.length <= 0) {
      return "no observe targets"
    }
    if (this.creepObserveLogs.length <= 0) {
      return "no convoy observed"
    }
    return this.creepObserveLogs.map(log => `- ${logDescription(log)}`).join("\n")
  }

  public runOnTick(): void {
    if (Environment.world !== "season 4") {
      PrimitiveLogger.programError(`${this.taskIdentifier} do NOT call this script outside of Season4 (${Environment.world})`)
      return
    }

    if ((Game.time % 1511) === 37) {
      this.gabageCollection()
    }

    this.observingHighways.forEach(highwayInfo => {
      this.observeRoom(highwayInfo.highway.startRoomName, highwayInfo, "start")
      this.observeRoom(highwayInfo.highway.endRoomName, highwayInfo, "end")
    })
  }

  private observeRoom(observeRoomName: RoomName, highwayInfo: HighwayObservingInfo, roomPosition: "start" | "end"): void {
    const room = Game.rooms[observeRoomName]
    if (room == null) {
      return
    }
    const npcCreeps = room.find(FIND_HOSTILE_CREEPS, { filter: { owner: { username: SYSTEM_USERNAME } } })
    if (npcCreeps.length <= 0) {
      return
    }

    let shouldObserve = false as boolean
    npcCreeps.forEach(creep => {
      const { shouldObserveRoom } = this.npcCreepObserved(creep, highwayInfo.highway.direction, roomPosition, highwayInfo)
      if (shouldObserveRoom === true) {
        shouldObserve = true
      }
    })

    if (shouldObserve === true) {
      Season4ObserverManager.reserveObservation(highwayInfo.observerRoomName, observeRoomName, 2, {retry: true})
    }
  }

  private npcCreepObserved(creep: Creep, highwayDirection: HighwayDirection, roomPosition: "start" | "end", highway: HighwayObservingInfo): { shouldObserveRoom: boolean } {
    if (this.ignoreCreepIds.includes(creep.id) === true) {
      return {shouldObserveRoom: false}
    }
    if (this.convoyCreeps[creep.id] != null) {
      return { shouldObserveRoom: false }
    }
    const firstLookCreepInfo = this.firstLookConvoyCreeps[creep.id]
    if (firstLookCreepInfo != null) {
      switch (highwayDirection) {
      case "vertical": {
        const dy = creep.pos.y - firstLookCreepInfo.localPosition.y
        if (dy === 0) {
          return { shouldObserveRoom: true }
        }
        const convoyCreepInfo = this.createConvoyCreepInVerticalHighway(firstLookCreepInfo, dy > 0 ? 1 : -1, roomPosition)
        this.didFoundConvoy(creep.id, convoyCreepInfo, highway)
        this.convoyCreeps[creep.id] = convoyCreepInfo
        break
      }
      case "horizontal": {
        const dx = creep.pos.x - firstLookCreepInfo.localPosition.x
        if (dx === 0) {
          return { shouldObserveRoom: true }
        }
        const convoyCreepInfo = this.createConvoyCreepInHorizontalHighway(firstLookCreepInfo, dx > 0 ? 1 : -1, roomPosition)
        this.didFoundConvoy(creep.id, convoyCreepInfo, highway)
        this.convoyCreeps[creep.id] = convoyCreepInfo
        break
      }
      }
      delete this.firstLookConvoyCreeps[creep.id]
      return { shouldObserveRoom: false }
    }

    const storedResourceTypes = Array.from(Object.keys(creep.store)) as ResourceConstant[]
    const resourceType = storedResourceTypes[0]
    if (storedResourceTypes.length !== 1 || resourceType == null || !isCommodityConstant(resourceType)) {
      this.ignoreCreepIds.push(creep.id)
      return { shouldObserveRoom: false }
    }
    const score = getSeason4CommodityScore(resourceType)
    if (score == null || score <= 0) {
      this.ignoreCreepIds.push(creep.id)
      return { shouldObserveRoom: false }
    }

    this.firstLookConvoyCreeps[creep.id] = {
      observedAt: Game.time,
      commodityType: resourceType,
      localPosition: { x: creep.pos.x, y: creep.pos.y },
      roomName: creep.room.name,
    }
    return { shouldObserveRoom: true }
  }

  private didFoundConvoy(convoyCreepId: Id<Creep>, info: ConvoyCreepInfo, highway: HighwayObservingInfo): void {
    this.launchScoreProcess(convoyCreepId, info, highway)
    this.convoyFoundLog(info)
  }

  private launchScoreProcess(convoyCreepId: Id<Creep>, info: ConvoyCreepInfo, highway: HighwayObservingInfo, options?: {ignoreScoreableResource?: boolean, amount?: number | "all"}): void {
    const notLaunchedLog = (reason: string): void => {
      processLog(this, `score ${coloredResourceType(info.commodityType)} not launched: ${reason}`)
    }

    if (this.options.launchScoreProcess !== true) {
      notLaunchedLog("disabled")
      return
    }
    const defaultAmountValue = 999
    if (options?.ignoreScoreableResource !== true) {
      if (this.scoreableResources.includes(info.commodityType) !== true) {
        notLaunchedLog("not in the list")
        return
      }
      const tierMaxReserve = ((): number => {
        const commodityTier = getCommodityTier(info.commodityType)
        switch (commodityTier) {
        case 0:
        case 1:
        case 2:
          if (info.commodityType === RESOURCE_CRYSTAL) {
            return 0
          }
          return 20000
        case 3:
        case 4:
        case 5:
          return 0
        }
      })()

      const totalResourceAmount = ResourceManager.amount(info.commodityType)
      if (totalResourceAmount < tierMaxReserve) {
        notLaunchedLog(`less than max reserve (${tierMaxReserve})`)
        return
      }
    }
    if (info.estimatedDespawnTime < 500) {
      notLaunchedLog(`about to despawn (${info.estimatedDespawnTime})`)
      return
    }

    const defaultAmount = ((): number => {
      if (options?.amount == null) {
        return defaultAmountValue
      }
      if (typeof options.amount === "number") {
        return options.amount
      }
      return Math.min(ResourceManager.amount(info.commodityType), defaultAmountValue)
    })()

    const roomResource = RoomResources.getOwnedRoomResource(highway.scoreRoomName)
    const terminal = roomResource?.activeStructures.terminal
    if (terminal == null) {
      notLaunchedLog(`no terminal in ${roomLink(highway.scoreRoomName)}`)
      return
    }
    let commodityAmout = terminal.store.getUsedCapacity(info.commodityType)
    let transferFailed = false as boolean
    if (commodityAmout < defaultAmount) {
      const collectResult = ResourceManager.collect(info.commodityType, highway.scoreRoomName, defaultAmount)
      switch (collectResult.resultType) {
      case "succeeded":
        commodityAmout += collectResult.value
        break

      case "failed":
        transferFailed = true
        commodityAmout += collectResult.reason.sentAmount
        break
      }
    }

    const resourceManagerProcess = getResourceManagerProcess()
    if (resourceManagerProcess != null) {
      resourceManagerProcess.stopForAWhile()
    }

    const scoreAmount = Math.min(commodityAmout, defaultAmount)
    if (scoreAmount <= 0) {
      notLaunchedLog(`score amount is 0 (commodityAmout: ${commodityAmout}, defaultAmount: ${defaultAmount}, transferFailed: ${transferFailed})`)
      return
    }

    PrimitiveLogger.log(`${coloredText("[Launch]", "info")} launched score process ${scoreAmount} ${coloredResourceType(info.commodityType)} from ${roomLink(highway.scoreRoomName)} to ${roomLink(info.roomName)} (history: ${roomHistoryLink(highway.scoreRoomName, Game.time + 10)}`)

    OperatingSystem.os.addProcess(null, processId => {
      return Season4784484ScoreProcess.create(
        processId,
        highway.scoreRoomName,
        highway.highwayEntranceRoomName,
        highway.scoreDirection,
        info.commodityType,
        scoreAmount,
        convoyCreepId,
        info.estimatedDespawnTime,
        {
          dryRun: false,
        },
      )
    })
  }

  private convoyFoundLog(info: ConvoyCreepInfo): void {
    processLog(this, `${coloredText("[Warning]", "warn")} found convoy ${coloredResourceType(info.commodityType)} in ${roomLink(info.roomName)} at ${info.observedAt}, direction: ${directionDescription(info.direction)}, estimated ${info.estimatedDespawnTime} to despawn`)
  }

  private createConvoyCreepInVerticalHighway(firstLookInfo: FirstLookConvoyCreep, dy: 1 | -1, roomPosition: "start" | "end"): ConvoyCreepInfo {
    const direction = dy > 0 ? BOTTOM : TOP
    const estimatedDespawnTime = ((): Timestamp => {
      const convoySpeed = 2
      const averageConvoyCreepCount = 5

      // 部屋の境界では1sq/tickで進むため
      const ticksToPassRoom = ((GameConstants.room.size - averageConvoyCreepCount) * convoySpeed) + averageConvoyCreepCount
      const shortDuration = 0 * ticksToPassRoom
      const longDuration = 8 * ticksToPassRoom
      switch (roomPosition) {
      case "start": // 上
        return direction === TOP ? shortDuration : longDuration
      case "end": // 下
        return direction === BOTTOM ? shortDuration : longDuration
      }
    })()

    return {
      observedAt: Game.time,
      commodityType: firstLookInfo.commodityType,
      roomName: firstLookInfo.roomName,
      direction,
      estimatedDespawnTime,
    }
  }

  private createConvoyCreepInHorizontalHighway(firstLookInfo: FirstLookConvoyCreep, dx: 1 | -1, roomPosition: "start" | "end"): ConvoyCreepInfo {
    const direction = dx > 0 ? RIGHT : LEFT
    const estimatedDespawnTime = ((): Timestamp => {
      const convoySpeed = 2
      const shortDuration = 0 * GameConstants.room.size * convoySpeed
      const longDuration = 8 * GameConstants.room.size * convoySpeed
      switch (roomPosition) {
      case "start": // 右
        return direction === RIGHT ? shortDuration : longDuration
      case "end": // 左
        return direction === LEFT ? shortDuration : longDuration
      }
    })()

    return {
      observedAt: Game.time,
      commodityType: firstLookInfo.commodityType,
      roomName: firstLookInfo.roomName,
      direction,
      estimatedDespawnTime,
    }
  }

  private gabageCollection(): void {
    const tooOldTimestamp = Game.time - GameConstants.creep.life.lifeTime
    if (tooOldTimestamp < 0) {
      return
    }

    const logs: ObserveLog[] = []

    const fitstLookConvoyCreeps = Array.from(Object.entries(this.firstLookConvoyCreeps))
    fitstLookConvoyCreeps.forEach(([creepId, firstLook]) => {
      if (firstLook.observedAt > tooOldTimestamp) {
        return
      }

      logs.push({
        observedAt: firstLook.observedAt,
        commodityType: firstLook.commodityType,
        direction: "unknown",
        roomName: firstLook.roomName,
      })
      delete this.firstLookConvoyCreeps[creepId]
    })

    const convoyCreeps = Array.from(Object.entries(this.convoyCreeps))
    convoyCreeps.forEach(([creepId, convoyCreep]) => {
      if (convoyCreep.observedAt > tooOldTimestamp) {
        return
      }

      logs.push({
        observedAt: convoyCreep.observedAt,
        commodityType: convoyCreep.commodityType,
        direction: convoyCreep.direction,
        roomName: convoyCreep.roomName,
      })
      delete this.convoyCreeps[creepId]
    })

    logs.sort((lhs, rhs) => {
      return lhs.observedAt - rhs.observedAt
    })

    this.creepObserveLogs.push(...logs)
    this.ignoreCreepIds = []
  }

  private addObserveRequest(highwayInfo: HighwayObservingInfo): void {
    Season4ObserverManager.addRequest(highwayInfo.observerRoomName, highwayInfo.highway.startRoomName, "long", 1)
    Season4ObserverManager.addRequest(highwayInfo.observerRoomName, highwayInfo.highway.endRoomName, "long", 1)
  }
}

function highwayDescription(highway: Highway): string {
  return `${roomLink(highway.startRoomName)} = ${roomLink(highway.endRoomName)}`
}

function convoyCreepDescription(convoyCreep: ConvoyCreepInfo): string {
  return `${roomLink(convoyCreep.roomName)} ${directionDescription(convoyCreep.direction)} ${coloredResourceType(convoyCreep.commodityType)} at ${convoyCreep.observedAt}, estimate despawn ${convoyCreep.estimatedDespawnTime} ticks`
}

function logDescription(log: ObserveLog): string {
  const timestamp = describeTime(Game.time - log.observedAt)
  const direction = ((): string => {
    if (typeof log.direction === "string") {
      return log.direction
    }
    return directionDescription(log.direction)
  })()
  return `${coloredResourceType(log.commodityType)} ${timestamp} ago ${direction} in ${roomLink(log.roomName)}`
}


import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { getHighwayRooms, Highway, RoomCoordinate, RoomName } from "utility/room_name"
import { MessageObserver } from "os/infrastructure/message_observer"
import { coloredResourceType, coloredText, describeTime, roomLink } from "utility/log"
import { Timestamp } from "utility/timestamp"
import { Environment } from "utility/environment"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Season4ObserverManager } from "./season4_observer_manager"
import { Position } from "prototype/room_position"
import { directionDescription, GameConstants } from "utility/constants"
import { isCommodityConstant } from "utility/resource"
import { KeywordArguments } from "os/infrastructure/console_command/utility/keyword_argument_parser"
import { processLog } from "os/infrastructure/logger"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { ValuedArrayMap } from "utility/valued_collection"

declare const COMMODITY_SCORE: { [commodityType: string]: number }

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
  readonly highway: {
    readonly direction: HighwayDirection
    readonly startRoomName: RoomName
    readonly endRoomName: RoomName
  }
}

export interface Season4ScoreLauncherProcessState extends ProcessState {
  readonly observingHighways: HighwayObservingInfo[]
  readonly firstLookConvoyCreeps: { [creepId: string]: FirstLookConvoyCreep }
  readonly convoyCreeps: {[creepId: string]: ConvoyCreepInfo}
  readonly creepObserveLogs: ObserveLog[]
  readonly ignoreCreepIds: Id<Creep>[]
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
    )
  }

  public static create(processId: ProcessId): Season4ScoreLauncherProcess {
    return new Season4ScoreLauncherProcess(Game.time, processId, [], {}, {}, [], [])
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      `observing ${this.observingHighways.length} highways`,
    ]
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
        `- highway ${roomLink(highway.startRoomName)} = ${roomLink(highway.endRoomName)}, observed from: ${roomLink(highwayInfo.observerRoomName)}, score: ${roomLink(highwayInfo.scoreRoomName)}`
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
    const commandList = ["help", "status", "add_highway", "remove_highway", "show_convoy", "show_logs"]
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

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
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

    const targetHighwayInfo: HighwayObservingInfo = {
      observerRoomName,
      scoreRoomName,
      highwayEntranceRoomName: highwayEntranceRoomCoordinate.roomName,
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

  private observeRoom(roomName: RoomName, highwayInfo: HighwayObservingInfo, roomPosition: "start" | "end"): void {
    const room = Game.rooms[roomName]
    if (room == null) {
      return
    }
    const npcCreeps = room.find(FIND_HOSTILE_CREEPS, { filter: { owner: { username: SYSTEM_USERNAME } } })
    if (npcCreeps.length <= 0) {
      return
    }

    let shouldObserve = false as boolean
    npcCreeps.forEach(creep => {
      const { shouldObserveRoom } = this.npcCreepObserved(creep, highwayInfo.highway.direction, roomPosition)
      if (shouldObserveRoom === true) {
        shouldObserve = true
      }
    })

    if (shouldObserve === true) {
      Season4ObserverManager.reserveObservation(highwayInfo.observerRoomName, roomName, 2, {retry: true})
    }
  }

  private npcCreepObserved(creep: Creep, highwayDirection: HighwayDirection, roomPosition: "start" | "end"): { shouldObserveRoom: boolean } {
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
        this.convoyFoundLog(convoyCreepInfo)
        this.convoyCreeps[creep.id] = convoyCreepInfo
        break
      }
      case "horizontal": {
        const dx = creep.pos.x - firstLookCreepInfo.localPosition.x
        if (dx === 0) {
          return { shouldObserveRoom: true }
        }
        const convoyCreepInfo = this.createConvoyCreepInHorizontalHighway(firstLookCreepInfo, dx > 0 ? 1 : -1, roomPosition)
        this.convoyFoundLog(convoyCreepInfo)
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
    const score = COMMODITY_SCORE[resourceType]
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
      case "start": // 左
        return direction === LEFT ? shortDuration : longDuration
      case "end": // 右
        return direction === RIGHT ? shortDuration : longDuration
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

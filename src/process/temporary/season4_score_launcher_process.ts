import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { getHighwayRooms, Highway, RoomName } from "utility/room_name"
import { MessageObserver } from "os/infrastructure/message_observer"
import { coloredResourceType, coloredText, describeTime, roomLink } from "utility/log"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { Timestamp } from "utility/timestamp"
import { Environment } from "utility/environment"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Season4ObserverManager } from "./season4_observer_manager"
import { Position } from "prototype/room_position"
import { directionDescription, GameConstants } from "utility/constants"
import { isCommodityConstant } from "utility/resource"

declare const COMMODITY_SCORE: { [commodityType: string]: number }

ProcessDecoder.register("Season4ScoreLauncherProcess", state => {
  return Season4ScoreLauncherProcess.decode(state as Season4ScoreLauncherProcessState)
})

type ConvoyDirection = TOP | BOTTOM | LEFT | RIGHT

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
  readonly direction: "vertical" | "horizontal"
  readonly startRoomName: RoomName
  readonly endRoomName: RoomName
}

export interface Season4ScoreLauncherProcessState extends ProcessState {
  readonly observingHighways: HighwayObservingInfo[]
  readonly firstLookConvoyCreeps: { [creepId: string]: FirstLookConvoyCreep }
  readonly convoyCreeps: {[creepId: string]: ConvoyCreepInfo}
  readonly creepObserveLogs: ObserveLog[]
}

export class Season4ScoreLauncherProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly observingHighways: HighwayObservingInfo[],
    private readonly firstLookConvoyCreeps: { [creepId: string]: FirstLookConvoyCreep },
    private readonly convoyCreeps: { [creepId: string]: ConvoyCreepInfo },
    private readonly creepObserveLogs: ObserveLog[],
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
    }
  }

  public static decode(state: Season4ScoreLauncherProcessState): Season4ScoreLauncherProcess {
    return new Season4ScoreLauncherProcess(state.l, state.i, state.observingHighways, state.firstLookConvoyCreeps, state.convoyCreeps, state.creepObserveLogs)
  }

  public static create(processId: ProcessId): Season4ScoreLauncherProcess {
    return new Season4ScoreLauncherProcess(Game.time, processId, [], {}, {}, [])
  }

  public processShortDescription(): string {
    return "not implemented yet"
  }

  public processDescription(): string {
    return "not implemented yet"
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "add_highway", "show_logs"]
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
  private addHighway(args: string[]): string {
    const listArguments = new ListArguments(args)
    const observerRoomResource = listArguments.ownedRoomResource(0, "observer room name").parse()
    const observerRoomName = observerRoomResource.room.name
    if (observerRoomResource.activeStructures.observer == null) {
      throw `${roomLink(observerRoomName)} has no observer`
    }

    const highwayRoomCoordinate = listArguments.roomCoordinate(1, "room name on highway").parse()
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

    if (this.observingHighways.some(info => info.startRoomName === startRoomName && info.endRoomName === endRoomName) === true) {
      throw `Highway ${highwayDescription(targetHighway)} is already been observed`
    }

    const startRoomObserveDistance = Game.map.getRoomLinearDistance(observerRoomName, startRoomName)
    const endRoomObserveDistance = Game.map.getRoomLinearDistance(observerRoomName, endRoomName)
    if (startRoomObserveDistance > 10 || endRoomObserveDistance > 10) {
      throw `Highway ${highwayDescription(targetHighway)} is not in observer range. ${roomLink(observerRoomName)} =${startRoomObserveDistance}= ${roomLink(startRoomName)}, ${roomLink(observerRoomName)} =${endRoomObserveDistance}= ${roomLink(endRoomName)}`
    }

    const targetHighwayInfo: HighwayObservingInfo = {
      observerRoomName,
      direction: targetHighway.direction,
      startRoomName,
      endRoomName
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

    // if ((Game.time % 17) !== 3) {
    //   return
    // }

    this.observingHighways.forEach(highwayInfo => {
      this.observeRoom(highwayInfo.startRoomName)
      this.observeRoom(highwayInfo.endRoomName)
    })
  }

  private observeRoom(roomName: RoomName): void {
    const room = Game.rooms[roomName]
    if (room == null) {
      return
    }
    const npcCreeps = room.find(FIND_HOSTILE_CREEPS, { filter: { owner: { username: SYSTEM_USERNAME } } })
    if (npcCreeps.length <= 0) {
      return
    }

    const time = Game.time
    npcCreeps.forEach(creep => {
      if (this.firstLookConvoyCreeps[creep.id] != null) {
        return
      }
      const storedResourceTypes = Array.from(Object.keys(creep.store)) as ResourceConstant[]
      const resourceType = storedResourceTypes[0]
      if (storedResourceTypes.length !== 1 || resourceType == null || !isCommodityConstant(resourceType)) {
        return
      }
      const score = COMMODITY_SCORE[resourceType]
      if (score == null || score <= 0) {
        return
      }
      this.firstLookConvoyCreeps[creep.id] = {
        observedAt: time,
        commodityType: resourceType,
        localPosition: { x: creep.pos.x, y: creep.pos.y },
        roomName: creep.room.name,
      }
    })
  }

  // private convoyCreepInfo(creep: Creep): ObserveLog | null {
  //   const storedResources = Array.from(Object.entries(creep.store))
  //   if (storedResources.length !== 1 || storedResources[0] == null) {
  //     return null
  //   }
  //   // TODO: 得点されていた（= 得点する余地が少ない）場合の処理
  //   const resourceType = storedResources[0][0]
  //   const score = COMMODITY_SCORE[resourceType]
  //   if (score == null || score <= 0) {
  //     return null
  //   }
  //   return {
  //     creepId: creep.id,
  //     observedAt: Game.time,
  //     commodityType: resourceType as CommodityConstant,
  //     roomName: creep.room.name,
  //   }
  // }

  private gabageCollection(): void {
    const tooOldTimestamp = Game.time - GameConstants.creep.life.lifeTime
    if (tooOldTimestamp < 0) {
      return
    }

    const logs: ObserveLog[] = []

    const fitstLookConvoyCreeps = Array.from(Object.entries(this.firstLookConvoyCreeps))
    fitstLookConvoyCreeps.forEach(([creepId, firstLook]) => {
      if (firstLook.observedAt < tooOldTimestamp) {
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
      if (convoyCreep.observedAt < tooOldTimestamp) {
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
  }

  private addObserveRequest(highwayInfo: HighwayObservingInfo): void {
    Season4ObserverManager.addRequest(highwayInfo.observerRoomName, highwayInfo.startRoomName, "long", 3)
    Season4ObserverManager.addRequest(highwayInfo.observerRoomName, highwayInfo.endRoomName, "long", 3)
  }
}

function highwayDescription(highway: Highway): string {
  return `${roomLink(highway.startRoomName)} = ${roomLink(highway.endRoomName)}`
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

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { getHighwayRooms, Highway, RoomName } from "utility/room_name"
import { MessageObserver } from "os/infrastructure/message_observer"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { Timestamp } from "utility/timestamp"
import { Environment } from "utility/environment"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { } from "./season4_observer_manager"

declare const COMMODITY_SCORE: { [commodityType: string]: number }

ProcessDecoder.register("Season4ScoreLauncherProcess", state => {
  return Season4ScoreLauncherProcess.decode(state as Season4ScoreLauncherProcessState)
})

type ConvoyDirection = TOP | BOTTOM | LEFT | RIGHT

type ConvoyCreepInfo = {
  readonly id: Id<Creep>
  readonly commodityType: CommodityConstant
  readonly roomName: RoomName
  readonly direction: ConvoyDirection
  readonly destinationRoomName: RoomName
}

type ObserveLog = {
  readonly creepId: Id<Creep>
  readonly observedAt: Timestamp
  readonly commodityType: CommodityConstant
  readonly roomName: RoomName
}

type HighwayObservingInfo = {
  readonly highway: Highway
  readonly roomNames: RoomName[]
}

export interface Season4ScoreLauncherProcessState extends ProcessState {
  readonly observingHighways: HighwayObservingInfo[]
  readonly observeLogs: ObserveLog[]
}

export class Season4ScoreLauncherProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly observingHighways: HighwayObservingInfo[],
    private readonly observeLogs: ObserveLog[],
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): Season4ScoreLauncherProcessState {
    return {
      t: "Season4ScoreLauncherProcess",
      l: this.launchTime,
      i: this.processId,
      observingHighways: this.observingHighways,
      observeLogs: this.observeLogs,
    }
  }

  public static decode(state: Season4ScoreLauncherProcessState): Season4ScoreLauncherProcess {
    return new Season4ScoreLauncherProcess(state.l, state.i, state.observingHighways, state.observeLogs)
  }

  public static create(processId: ProcessId): Season4ScoreLauncherProcess {
    return new Season4ScoreLauncherProcess(Game.time, processId, [], [])
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
    const highwayRoomCoordinate = listArguments.roomCoordinate(0, "room name on highway").parse()
    const highwayRoomName = highwayRoomCoordinate.roomName
    const detailedCoordinate = highwayRoomCoordinate.detailedCoordinate()
    if (detailedCoordinate.case !== "highway") {
      throw `${roomLink(highwayRoomName)} is not on a highway (${detailedCoordinate.case})`
    }
    const targetHighway = detailedCoordinate.highway
    if (this.observingHighways.some(info => info.highway.startRoomName === targetHighway.startRoomName && info.highway.endRoomName === targetHighway.endRoomName) === true) {
      throw `Highway ${highwayDescription(targetHighway)} is already been observed`
    }

    const roomNames = getHighwayRooms(targetHighway)
    if (roomNames.length <= 0) {
      throw `Highway ${highwayDescription(targetHighway)} has no rooms`
    }
    this.observingHighways.push({
      highway: targetHighway,
      roomNames,
    })

    return `Added ${highwayDescription(targetHighway)}`
  }

  private showLogs(): string {
    if (this.observingHighways.length <= 0) {
      return "no observe targets"
    }
    if (this.observeLogs.length <= 0) {
      return "no convoy observed"
    }
    return this.observeLogs.map(log => `- ${logDescription(log)}`).join("\n")
  }

  public runOnTick(): void {
    if (Environment.world !== "season 4") {
      PrimitiveLogger.programError(`${this.taskIdentifier} do NOT call this script outside of Season4 (${Environment.world})`)
      return
    }

    if ((Game.time % 17) !== 3) {
      return
    }

    this.observingHighways.forEach(highwayInfo => {
      highwayInfo.roomNames.forEach(roomName => {
        const room = Game.rooms[roomName]
        if (room == null) {
          return
        }
        this.observeRoom(room)
      })
    })
  }

  private observeRoom(room: Room): void {
    const npcCreeps = room.find(FIND_HOSTILE_CREEPS, { filter: { owner: { username: SYSTEM_USERNAME } } })
    if (npcCreeps.length <= 0) {
      return
    }

    npcCreeps.forEach(creep => {
      const log = this.convoyCreepInfo(creep)
      if (log == null) {
        return
      }
      this.addObserveLog(log)
    })
  }

  private convoyCreepInfo(creep: Creep): ObserveLog | null {
    const storedResources = Array.from(Object.entries(creep.store))
    if (storedResources.length !== 1 || storedResources[0] == null) {
      return null
    }
    // TODO: 得点されていた（= 得点する余地が少ない）場合の処理
    const resourceType = storedResources[0][0]
    const score = COMMODITY_SCORE[resourceType]
    if (score == null || score <= 0) {
      return null
    }
    return {
      creepId: creep.id,
      observedAt: Game.time,
      commodityType: resourceType as CommodityConstant,
      roomName: creep.room.name,
    }
  }

  private addObserveLog(log: ObserveLog): void {
    if (this.observeLogs.some(observeLog => observeLog.creepId === log.creepId) === true) {
      return
    }
    this.observeLogs.push(log)
  }
}

function highwayDescription(highway: Highway): string {
  return `${roomLink(highway.startRoomName)} = ${roomLink(highway.endRoomName)}`
}

function logDescription(log: ObserveLog): string {
  const timestamp = ((): string => {
    const duration = Game.time - log.observedAt
    if (duration < 1000) {
      return `${duration}ticks ago`
    }
    return `${Math.floor(duration / 1000)}k ticks ago`
  })()
  return `${coloredResourceType(log.commodityType)} ${timestamp} at ${roomLink(log.roomName)}`
}

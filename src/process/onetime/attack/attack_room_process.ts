import { MessageObserver } from "os/infrastructure/message_observer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { Position } from "prototype/room_position"
import { describeTime, roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { Timestamp } from "utility/timestamp"

ProcessDecoder.register("AttackRoomProcess", state => {
  return AttackRoomProcess.decode(state as AttackRoomProcessState)
})

type TargetStructure<T extends Structure<BuildableStructureConstant>> = {
  readonly id: Id<T>
  readonly position: Position
  readonly rampartHits: number
}

type Bunker = {
  readonly towers: TargetStructure<StructureTower>[]
  readonly spawns: TargetStructure<StructureSpawn>[]
  readonly targetWalls: TargetStructure<StructureWall | StructureRampart>[]
}
type TargetRoomPlan = {
  readonly calculatedAt: Timestamp
  readonly bunkers: Bunker[]
}

type ObserveRecord = {
  readonly owner: Owner | null
  readonly safemodeEndsAt: number | null
  readonly observedAt: number
  readonly roomPlan: TargetRoomPlan | null
}

type TargetRoomInfo = {
  readonly roomName: RoomName
  observeRecord: ObserveRecord | null
}

type CreepKilledLog = {
  case: "creep killed"
  bodyDescription: string
}
type HostileCreepKilledLog = {
  case: "hostile creep killed"
  bodyDescription: string
}
type HostileStructureDestroyedLog = {
  case: "hostile structure destroyed"
  structureType: StructureConstant
}
type Log = CreepKilledLog | HostileCreepKilledLog | HostileStructureDestroyedLog

interface AttackRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomInfo: TargetRoomInfo
  readonly resourceSpent: { [resourceType: string]: number }
  readonly logs: Log[]
}

export class AttackRoomProcess implements Process, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomInfo: TargetRoomInfo,
    private readonly resourceSpent: { [resourceType: string]: number },
    private readonly logs: Log[],
  ) {
    this.identifier = `${this.constructor.name}`
  }

  public encode(): AttackRoomProcessState {
    return {
      t: "AttackRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomInfo: this.targetRoomInfo,
      resourceSpent: this.resourceSpent,
      logs: this.logs,
    }
  }

  public static decode(state: AttackRoomProcessState): AttackRoomProcess {
    return new AttackRoomProcess(state.l, state.i, state.roomName, state.targetRoomInfo, state.resourceSpent, state.logs)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): AttackRoomProcess {
    const targetRoomInfo: TargetRoomInfo = {
      roomName: targetRoomName,
      observeRecord: null,
    }

    return new AttackRoomProcess(Game.time, processId, roomName, targetRoomInfo, {}, [])
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "show_target_room_info"]

    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `Commands: ${commandList}`

    case "show_target_room_info":
      return this.showTargetRoomInfo()

    default:
      return `Invalid command ${command}. "help" to show command list`
    }
  }

  private showTargetRoomInfo(): string {
    const targetRoomPlan = this.targetRoomInfo.observeRecord?.roomPlan
    if (targetRoomPlan == null) {
      return `${roomLink(this.targetRoomInfo.roomName)} no room plan`
    }

    const info: string[] = [
      `calculated at ${describeTime(Game.time - targetRoomPlan.calculatedAt)} ago, ${targetRoomPlan.bunkers.length} bunkers`,
      ...targetRoomPlan.bunkers.map(bunker => `- ${bunker.towers.length} towers, ${bunker.spawns.length} spawns`),
    ]
    return info.join("\n")
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomInfo.roomName]
    if (targetRoom == null) {
      return  // constructionSaboteurProcessが動いているはず
    }
    if (targetRoom.controller == null || targetRoom.controller.owner == null) {
      PrimitiveLogger.notice(`${this.identifier} ${roomLink(this.targetRoomInfo.roomName)} is no longer occupied`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const controller = targetRoom.controller
    const owner = targetRoom.controller.owner

    const safemodeEndsAt = ((): number | null => {
      if (controller.safeMode == null) {
        return null
      }
      return controller.safeMode + Game.time
    })()

    const targetRoomPlan = ((): TargetRoomPlan => {
      const storedPlan = this.targetRoomInfo.observeRecord?.roomPlan
      if (storedPlan != null) {
        if (Game.time - storedPlan.calculatedAt < 1000) {
          return storedPlan
        }
      }
      return this.calculateRoomPlan(targetRoom)
    })()

    const observeRecord: ObserveRecord = {
      owner,
      observedAt: Game.time,
      safemodeEndsAt,
      roomPlan: targetRoomPlan,
    }

    this.targetRoomInfo.observeRecord = observeRecord
  }

  private calculateRoomPlan(targetRoom: Room): TargetRoomPlan {
    // TODO: 複数bunkerの部屋を解釈できるようにする
    const bunker: Bunker = {
      towers: this.getStructure(STRUCTURE_TOWER, targetRoom) as TargetStructure<StructureTower>[],
      spawns: this.getStructure(STRUCTURE_SPAWN, targetRoom) as TargetStructure<StructureSpawn>[],
      targetWalls: [],  // TODO:
    }

    return {
      calculatedAt: Game.time,
      bunkers: [bunker],
    }
  }

  private getStructure<T extends BuildableStructureConstant>(structureType: T, room: Room): TargetStructure<Structure<T>>[] {
    const wallStructureTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
    const getRampartHits = (structure: Structure<T>): number => {
      if (wallStructureTypes.includes(structure.structureType) === true) {
        return structure.hits
      }
      const rampart = structure.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } })[0]
      if (rampart == null) {
        return 0
      }
      return rampart.hits
    }

    const structures: Structure<T>[] = room.find<Structure<T>>(FIND_STRUCTURES, { filter: { structureType: structureType } })
    return structures.map((structure): TargetStructure<Structure<T>> => {
      return {
        id: structure.id,
        position: { x: structure.pos.x, y: structure.pos.y },
        rampartHits: getRampartHits(structure),
      }
    })
  }
}

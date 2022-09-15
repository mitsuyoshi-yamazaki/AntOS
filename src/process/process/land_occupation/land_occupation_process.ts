import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { generateCodename } from "utility/unique_id"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { CreepName } from "prototype/creep"
import { Position } from "shared/utility/position"
import { processLog } from "os/infrastructure/logger"
import type { Timestamp } from "shared/utility/timestamp"
import { CreepBody } from "utility/creep_body"

type ClusterBaseType = {
  readonly position: Position
  readonly container: Id<StructureContainer> | null
  readonly constructing: Id<ConstructionSite<BuildableStructureConstant>> | null
  readonly ramparts: Id<StructureRampart>[]
}
type ClusterTypeSource = ClusterBaseType & {
  readonly source: Id<Source>
  readonly harvester: CreepName | null
}
type ClusterTypeMainSource = ClusterTypeSource & {
  readonly case: "main"
  readonly spawn: Id<StructureSpawn>
  readonly tower: Id<StructureTower> | null
}
// type ClusterTypeSubSource = ClusterTypeSource & {
//   readonly case: "sub"
// }
type ClusterTypeController = ClusterBaseType & {
  readonly case: "controller"
  readonly walls: Id<StructureWall>[]
}
type ClusterCase = (ClusterTypeMainSource | ClusterTypeController)["case"]

type RoomStateUnoccupied = {
  readonly case: "unoccupied"
  readonly level: number
  readonly claimerName: CreepName | null
  readonly mainSourceId: Id<Source>
  readonly mainSourcePosition: Position
}
type RoomStateNoStructures = {
  readonly case: "no structures"
  readonly level: number
  readonly workers: CreepName[]
  readonly mainSourceId: Id<Source>
  readonly mainSourcePosition: Position
  readonly harvesters: { creepName: CreepName, sourceId: Id<Source> }[] // RoomStateWorkingからSpawnが破壊されてNoStructureに戻った場合は存在する
  readonly spawnConstructionSite: Id<ConstructionSite<STRUCTURE_SPAWN>> | null
}
type RoomStateWorking = {
  readonly case: "working"
  readonly level: number
  readonly mainSource: ClusterTypeMainSource
  // readonly subSource: ClusterTypeSubSource | null
  readonly controller: ClusterTypeController
  readonly hauler: CreepName | null
}
type RoomState = RoomStateUnoccupied | RoomStateNoStructures | RoomStateWorking

type HostileInfo = {
  readonly observed: Timestamp
  readonly attacking: Id<Creep> | null
  readonly creeps: {
    [CreepId: string]: {
      readonly creepType: "attacker" | "worker"
      readonly healPower: number
    }
  }
}

type QuingConstruction = {
  readonly position: Position
  readonly structureType: BuildableStructureConstant
  readonly cluster: ClusterCase
}

ProcessDecoder.register("LandOccupationProcess", state => {
  return LandOccupationProcess.decode(state as LandOccupationProcessState)
})

interface LandOccupationProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly parentRoomName: RoomName
  readonly roomState: RoomState
  readonly constructionQueue: QuingConstruction[]
  readonly hostileInfo: HostileInfo
}

export class LandOccupationProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly parentRoomName: RoomName,
    private roomState: RoomState,
    private readonly constructionQueue: QuingConstruction[],
    private readonly hostileInfo: HostileInfo,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): LandOccupationProcessState {
    return {
      t: "LandOccupationProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      parentRoomName: this.parentRoomName,
      roomState: this.roomState,
      constructionQueue: this.constructionQueue,
      hostileInfo: this.hostileInfo,
    }
  }

  public static decode(state: LandOccupationProcessState): LandOccupationProcess {
    return new LandOccupationProcess(
      state.l,
      state.i,
      state.roomName,
      state.parentRoomName,
      state.roomState,
      state.constructionQueue,
      state.hostileInfo,
    )
  }

  public static create(processId: ProcessId, controller: StructureController, mainSource: Source, mainPosition: Position, parentRoomName: RoomName): LandOccupationProcess {
    const roomState: RoomStateUnoccupied = {
      case: "unoccupied",
      level: 0,
      claimerName: null,
      mainSourceId: mainSource.id,
      mainSourcePosition: mainPosition,
    }

    return new LandOccupationProcess(
      Game.time,
      processId,
      controller.room.name,
      parentRoomName,
      roomState,
      [],
      getInitialHostileInfo(controller.room),
    )
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)}, parent: ${roomLink(this.parentRoomName)}`
  }

  public runOnTick(): void {
    const room = Game.rooms[this.roomName]
    const controller = room?.controller

    switch (this.roomState.case) {
    case "unoccupied":
      if (controller?.my === true) {
        const noStructureState: RoomStateNoStructures = {
          case: "no structures",
          level: controller.level,
          workers: [],
          harvesters: [],
          spawnConstructionSite: null,
          mainSourceId: this.roomState.mainSourceId,
          mainSourcePosition: this.roomState.mainSourcePosition,
        }
        this.roomState = noStructureState
        this.runNoStructure(noStructureState, controller)
        break
      }
      this.runUnoccupied(this.roomState, controller ?? null)
      break

    case "no structures":
      if (controller == null || controller.my !== true) {
        processLog(this, `${coloredText("[Downgrade]", "error")} controller lost`)
        const unoccupiedState: RoomStateUnoccupied = {
          case: "unoccupied",
          level: 0,
          claimerName: null,
          mainSourceId: this.roomState.mainSourceId,
          mainSourcePosition: this.roomState.mainSourcePosition,
        }
        this.roomState = unoccupiedState
        this.runUnoccupied(unoccupiedState, controller ?? null)
        break
      }
      this.checkLevelUp(controller, this.roomState.level)

      if (this.roomState.spawnConstructionSite != null && Game.getObjectById(this.roomState.spawnConstructionSite) == null) {
        const spawn = controller.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })[0] as StructureSpawn | null
        if (spawn != null) {
          const mainamparts = controller.room.find(FIND_MY_STRUCTURES, { filter })

          const workingState: RoomStateWorking = {
            case: "working",
            level: controller.level,
            mainSource: {
              case: "main",
              spawn: spawn.id,
              tower: null,
              source: this.roomState.mainSourceId,
              harvester: null,
              position: this.roomState.mainSourcePosition,
              container: null,
              constructing: null,
              ramparts,
            },
            controller: {

            },
            hauler: null,
          }
        }
      }

      this.runNoStructure(this.roomState, controller)
      break

    case "working":
      if (controller == null || controller.my !== true) {
        processLog(this, `${coloredText("[Downgrade]", "error")} controller lost`)
        const unoccupiedState: RoomStateUnoccupied = {
          case: "unoccupied",
          level: 0,
          claimerName: null,
        }
        this.roomState = unoccupiedState
        this.runUnoccupied(unoccupiedState, controller ?? null)
        break
      }
      this.checkLevelUp(controller, this.roomState.level)
      this.runWorking(this.roomState, controller)
      break

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.roomState
      break
    }
    }
  }

  private checkLevelUp(controller: StructureController, previousLevel: number): void {

  }

  private runUnoccupied(roomState: RoomStateUnoccupied, controller: StructureController | null): void {

  }

  private runNoStructure(roomState: RoomStateNoStructures, controller: StructureController): void {

  }

  private runWorking(roomState: RoomStateWorking, controller: StructureController): void {

  }
}

const getInitialHostileInfo = (room: Room): HostileInfo => {
  const creeps: {
    [CreepId: string]: {
      readonly creepType: "attacker" | "worker"
      readonly healPower: number
    }
  } = {}

  room.find(FIND_HOSTILE_CREEPS).filter(creep => {
    if (Game.isEnemy(creep.owner) !== true) {
      return false
    }
    const healPower = CreepBody.power(creep.body, "heal", {ignoreHits: true})
    const creepType = ((): "attacker" | "worker" => {
      if (healPower > 0) {
        return "attacker"
      }
      if (creep.body.some(body => body.type === ATTACK || body.type === RANGED_ATTACK || body.type === CLAIM) === true) {
        return "attacker"
      }
      return "worker"
    })()

    creeps[creep.id] = {
      healPower,
      creepType,
    }
  })

  return {
    observed: Game.time,
    attacking: null,
    creeps,
  }
}

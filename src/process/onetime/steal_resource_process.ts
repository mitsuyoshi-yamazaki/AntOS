import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { CreepBody } from "utility/creep_body"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { isResourceConstant, MineralBoostConstant } from "utility/resource"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { processLog } from "os/infrastructure/logger"
import { OperatingSystem } from "os/os"

const resourcePriority: ResourceConstant[] = [
  ...MineralBoostConstant,  // 添字の大きいほうが優先
  RESOURCE_OPS,
  RESOURCE_POWER,
]

type State = "stop_spawning" | "in progress" | "finished"
type TargetType = StructureStorage | StructureTerminal | StructureFactory

export interface StealResourceProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  targetId: Id<TargetType>
  state: State
  takeAll: boolean
  creepCount: number
  finishWorking: number
}

// Game.io("launch -l StealResourceProcess room_name=W45S31 target_room_name=W46S32 waypoints=W46S32 target_id=60600e57fb105b02dc9f9509")
export class StealResourceProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly targetId: Id<TargetType>,
    private state: State,
    private readonly takeAll: boolean,
    private readonly creepCount: number,
    private readonly finishWorking: number,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): StealResourceProcessState {
    return {
      t: "StealResourceProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      targetId: this.targetId,
      state: this.state,
      takeAll: this.takeAll,
      creepCount: this.creepCount,
      finishWorking: this.finishWorking,
    }
  }

  public static decode(state: StealResourceProcessState): StealResourceProcess {
    return new StealResourceProcess(state.l, state.i, state.p, state.tr, state.w, state.targetId, state.state, state.takeAll, state.creepCount ?? 1, state.finishWorking ?? 250)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], targetId: Id<TargetType>, takeAll: boolean, creepCount: number, finishWorkig: number): StealResourceProcess {
    return new StealResourceProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, targetId, "in progress", takeAll, creepCount, finishWorkig)
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    return `${roomLink(this.targetRoomName)} ${this.state}, ${creepCount}cr`
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    const resourceStore = ((): StructureTerminal | StructureStorage | null => {
      if (objects.activeStructures.terminal != null && objects.activeStructures.terminal.my === true) {
        return objects.activeStructures.terminal
      }
      if (objects.activeStructures.storage != null && objects.activeStructures.storage.my === true) {
        return objects.activeStructures.storage
      }
      return null
    } )()
    if (resourceStore == null) {
      return
    }

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (this.state === "finished" && creepCount <= 0) {
      processLog(this, `${coloredText("[Finished]", "info")} no more valuable resources in ${roomLink(this.targetRoomName)}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }
    const numberOfCreeps = ((): number => {
      if (this.state === "stop_spawning") {
        return 0
      }
      const targetRoom = Game.rooms[this.targetRoomName]
      if (targetRoom?.controller != null) {
        if (targetRoom.controller.my === true) {
          return 1
        }
        if (targetRoom.controller.safeMode != null) {
          this.state = "stop_spawning"
          return 0
        }
      }
      return this.creepCount
    })()
    if (this.state !== "finished" && creepCount < numberOfCreeps) {
      this.requestHauler(objects.controller.room.energyCapacityAvailable)
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newTaskFor(creep, resourceStore),
      () => true,
    )
  }

  private requestHauler(energyCapacity: number): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body: CreepBody.create([], [CARRY, MOVE], energyCapacity, 12),
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private newTaskFor(creep: Creep, store: StructureStorage | StructureTerminal): CreepTask | null {
    if (creep.room.name === this.parentRoomName) {
      const resourceType = Object.keys(creep.store).find(resource => {
        if (!isResourceConstant(resource)) {
          return false
        }
        return true
      }) as ResourceConstant | null
      if (resourceType != null) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(store, resourceType))
      }
    }

    if (creep.room.name === this.targetRoomName) {
      const target = Game.getObjectById(this.targetId)
      if (target != null) {
        if (creep.store.getFreeCapacity() > 0) {
          const resourceType = this.resourceToSteal(target)
          const shouldFinish = ((): boolean => {
            if (resourceType == null) {
              return true
            }
            if (this.takeAll !== true && resourcePriority.includes(resourceType) !== true) {
              return true
            }
            return false
          })()
          if (shouldFinish === true) {
            this.state = "finished"
          }
          if (resourceType != null) {
            return FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawResourceApiWrapper.create(target, resourceType)))
          }
        }
      }
      const waypoints = [...this.waypoints].reverse()
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.parentRoomName, waypoints))
    }

    if (creep.store.getUsedCapacity() <= 0) {
      if (creep.ticksToLive != null && (creep.ticksToLive < this.finishWorking)) {
        return RunApiTask.create(SuicideApiWrapper.create())
      }
      if (creep.room.name === this.parentRoomName) {
        return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, this.waypoints))
      } else {
        return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, []))
      }
    }

    return FleeFromAttackerTask.create(MoveToRoomTask.create(this.parentRoomName, []))
  }

  private resourceToSteal(target: TargetType): ResourceConstant | null {
    if (this.targetRoomName === "W46S32" && target.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      return RESOURCE_ENERGY
    }

    const resourceType = (Object.keys(target.store) as ResourceConstant[])
      .sort((lhs, rhs) => {
        return resourcePriority.indexOf(rhs) - resourcePriority.indexOf(lhs)
      })[0]
    return resourceType ?? null
  }
}
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { ProcessState } from "process/process_state"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepRole } from "prototype/creep_role"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { SwampRunnerTransferTask } from "v5_object_task/creep_task/meta_task/swamp_runner_transfer_task"
import { TransferResourceApiWrapper, TransferResourceApiWrapperTargetType } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { TransferEnergyApiWrapperTargetType } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"

export interface Season687888RunHaulerTestProcessState extends ProcessState {
  /** parent room name */
  r: RoomName

  /** transfer target id */
  d: Id<TransferResourceApiWrapperTargetType>
}

// Storage in W24S29
// Game.io("launch Season687888RunHaulerTestProcess room_name=W9S24 transfer_target_id=60e4638fa93a4e7878164ff2")
export class Season687888RunHaulerTestProcess implements Process, Procedural {
  private readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly transferTargetId: Id<TransferResourceApiWrapperTargetType>,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = "swamp_runner"
  }

  public encode(): Season687888RunHaulerTestProcessState {
    return {
      t: "Season687888RunHaulerTestProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.parentRoomName,
      d: this.transferTargetId,
    }
  }

  public static decode(state: Season687888RunHaulerTestProcessState): Season687888RunHaulerTestProcess | null {
    return new Season687888RunHaulerTestProcess(state.l, state.i, state.r, state.d)
  }

  public static create(processId: ProcessId, roomName: RoomName, transferTargetId: Id<TransferResourceApiWrapperTargetType>): Season687888RunHaulerTestProcess {
    return new Season687888RunHaulerTestProcess(Game.time, processId, roomName, transferTargetId)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    const numberOfHaulers = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (numberOfHaulers <= 0) {
      this.addHauler()
    }

    const storage = objects.activeStructures.storage
    const transferTarget = Game.getObjectById(this.transferTargetId)
    if (storage != null && transferTarget != null) {
      World.resourcePools.assignTasks(
        this.parentRoomName,
        this.identifier,
        CreepPoolAssignPriority.Low,
        () => this.swampRunnerTask(storage, transferTarget),
        () => true,
      )
    }
  }

  private addHauler(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body: [CARRY, CARRY, CARRY, MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private swampRunnerTask(storage: StructureStorage, transferTarget: TransferEnergyApiWrapperTargetType): CreepTask {
    const resourceType = RESOURCE_ENERGY
    const options: SequentialTaskOptions = {
      ignoreFailure: false,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      // RunApiTask.create(DropResourceApiWrapper.create(resourceType)),
      MoveToTargetTask.create(GetEnergyApiWrapper.create(storage)),
      SwampRunnerTransferTask.create(TransferResourceApiWrapper.create(transferTarget, resourceType)),
    ]
    return SequentialTask.create(tasks, options)
  }
}

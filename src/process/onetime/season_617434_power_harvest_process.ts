import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { RoomName } from "utility/room_name"
import { ProcessState } from "process/process_state"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"

export interface Season617434PowerHarvestProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName
}

// Game.io("launch -l Season617434PowerHarvestProcess room_name=W9S24 target_room_name=W10S24")
export class Season617434PowerHarvestProcess implements Process, Procedural {
  private readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season617434PowerHarvestProcessState {
    return {
      t: "Season617434PowerHarvestProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
    }
  }

  public static decode(state: Season617434PowerHarvestProcessState): Season617434PowerHarvestProcess | null {
    return new Season617434PowerHarvestProcess(state.l, state.i, state.p, state.tr)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName): Season617434PowerHarvestProcess {
    return new Season617434PowerHarvestProcess(Game.time, processId, parentRoomName, targetRoomName)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom == null) {
      const scoutCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, creep => hasNecessaryRoles(creep, [CreepRole.Scout]))
      if (scoutCount <= 0) {
        this.addScout
      }
    }
    this.runScout()

  }

  // ---- Scout ---- //
  private addScout(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Scout],
      body: [MOVE],
      initialTask: this.scoutTask(),
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runScout(): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      () => this.scoutTask(),
      () => true,
    )
  }

  private scoutTask(): CreepTask {
    const options: SequentialTaskOptions = {
      ignoreFailure: true,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, []),
      MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 10), // TODO: Controller付近にでも行かせる
      EndlessTask.create(),
    ]
    return SequentialTask.create(tasks, options)
  }
}

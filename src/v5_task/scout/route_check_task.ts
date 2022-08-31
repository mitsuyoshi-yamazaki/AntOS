import { ProblemFinder } from "v5_problem/problem_finder"
import type { RoomName } from "shared/utility/room_name_types"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "v5_task/general/general_creep_worker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { LaunchableTask } from "v5_task/launchable_task"

export interface RouteCheckTaskState extends GeneralCreepWorkerTaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** result route distance */
  d: number | null
}

// FixMe: targetRoomNameの境界で止まる
// Game.io("launch RouteCheckTask room_name=W24S29 target_room_name=W14S28 waypoints=W23S29,W23S30,W14S30")
export class RouteCheckTask extends GeneralCreepWorkerTask implements LaunchableTask {
  public readonly taskIdentifier: TaskIdentifier

  private readonly codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
    private resultRouteDistance: number | null,
  ) {
    super(startTime, children, roomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}_${this.startTime}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)
  }

  public encode(): RouteCheckTaskState {
    return {
      t: "RouteCheckTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      d: this.resultRouteDistance,
    }
  }

  public static decode(state: RouteCheckTaskState, children: Task[]): RouteCheckTask {
    return new RouteCheckTask(state.s, children, state.r, state.tr, state.w, state.d)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): RouteCheckTask {
    return new RouteCheckTask(Game.time, [], roomName, targetRoomName, waypoints, null)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom != null) {
      if (targetRoom.controller == null) {
        return TaskStatus.Failed
      }
      return TaskStatus.Finished
    }

    super.runTask(objects, childTaskResults)

    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  public creepFileterRoles(): CreepRole[] | null {
    return [CreepRole.Scout]
  }

  public creepRequest(): GeneralCreepWorkerTaskCreepRequest | null {
    if (this.resultRouteDistance != null) {
      return null
    }

    return {
      necessaryRoles: [CreepRole.Scout],
      taskIdentifier: this.taskIdentifier,
      numberOfCreeps: 1,
      codename: this.codename,
      initialTask: null,
      priority: CreepSpawnRequestPriority.Low,
      body: null
    }
  }

  public newTaskFor(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    const controller = creep.room.controller
    if (controller == null) {
      this.resultRouteDistance = 0
      return null
    }

    if (creep.pos.isNearTo(controller) === true) {
      this.resultRouteDistance = creep.ticksToLive ?? 0
      return null
    }
    return MoveToTask.create(controller.pos, 1)
  }
}

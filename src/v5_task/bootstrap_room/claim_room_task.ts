import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName } from "utility/room_name"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "v5_task/general/general_creep_worker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { MoveClaimControllerTask } from "v5_object_task/creep_task/combined_task/move_claim_controller_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"

export interface ClaimRoomTaskState extends GeneralCreepWorkerTaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]
}

export class ClaimRoomTask extends GeneralCreepWorkerTask {
  public readonly taskIdentifier: TaskIdentifier

  private readonly codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[]
  ) {
    super(startTime, children, roomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)
  }

  public encode(): ClaimRoomTaskState {
    return {
      t: "ClaimRoomTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
      w: this.waypoints
    }
  }

  public static decode(state: ClaimRoomTaskState, children: Task[]): ClaimRoomTask {
    return new ClaimRoomTask(state.s, children, state.r, state.tr, state.w)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): ClaimRoomTask {
    return new ClaimRoomTask(Game.time, [], roomName, targetRoomName, waypoints)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom != null && targetRoom.controller != null && targetRoom.controller.my === true) {
      return TaskStatus.Finished
    }

    super.runTask(objects, childTaskResults)

    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  public creepFileterRoles(): CreepRole[] | null {
    return [CreepRole.Claimer]
  }

  public creepRequest(): GeneralCreepWorkerTaskCreepRequest | null {
    const creepTask = MoveClaimControllerTask.create(this.targetRoomName, this.waypoints)

    return {
      necessaryRoles: [CreepRole.Claimer],
      taskIdentifier: this.taskIdentifier,
      numberOfCreeps: 1,
      codename: this.codename,
      initialTask: creepTask,
      priority: CreepSpawnRequestPriority.Medium,
      body: null
    }
  }

  public newTaskFor(): CreepTask | null {
    return MoveClaimControllerTask.create(this.targetRoomName, this.waypoints)
  }
}

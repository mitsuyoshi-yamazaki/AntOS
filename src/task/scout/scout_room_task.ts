import { RoomInvadedProblemFinder } from "problem/invasion/room_invaded_problem_finder"
import { ProblemFinder } from "problem/problem_finder"
import { OwnedRoomDecayedStructureProblemFinder } from "problem/structure/owned_room_decayed_structure_problem_finder"
import { RoomName } from "utility/room_name"
import { CreateConstructionSiteTask } from "task/room_planing/create_construction_site_task"
import { OwnedRoomScoutTask } from "task/scout/owned_room_scout_task"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { WorkerTask } from "task/worker/worker_task"
import { OwnedRoomObjects } from "world_info/room_info"

export interface ScoutRoomTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room names */
  tr: RoomName[]
}

export class ScoutRoomTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomNames: RoomName[],
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): ScoutRoomTaskState {
    return {
      t: "ScoutRoomTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomNames,
    }
  }

  public static decode(state: ScoutRoomTaskState): ScoutRoomTask {
    const children = decodeTasksFrom(state.c)
    return new ScoutRoomTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName[]): ScoutRoomTask {
    return new ScoutRoomTask(Game.time, [], roomName, targetRoomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const problemFinders: ProblemFinder[] = []  // TODO: creep insufficiency
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}

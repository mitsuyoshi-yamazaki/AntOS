import { RoomInvadedProblemFinder } from "problem/invasion/room_invaded_problem_finder"
import { ProblemFinder } from "problem/problem_finder"
import { OwnedRoomDecayedStructureProblemFinder } from "problem/structure/owned_room_decayed_structure_problem_finder"
import { RoomName } from "prototype/room"
import { CreateConstructionSiteTask } from "task/room_planing/create_construction_site_task"
import { OwnedRoomScoutTask } from "task/scout/owned_room_scout_task"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { WorkerTask } from "task/worker/worker_task"
import { OwnedRoomObjects } from "world_info/room_info"

export interface RoomKeeperTaskState extends TaskState {
  /** room name */
  r: RoomName
}

export class RoomKeeperTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): RoomKeeperTaskState {
    return {
      t: "RoomKeeperTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: RoomKeeperTaskState): RoomKeeperTask {
    const children = decodeTasksFrom(state.c)
    return new RoomKeeperTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): RoomKeeperTask {
    const children: Task[] = [
      CreateConstructionSiteTask.create(roomName),
      WorkerTask.create(roomName),
      OwnedRoomScoutTask.create(roomName),
    ]
    return new RoomKeeperTask(Game.time, children, roomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const problemFinders: ProblemFinder[] = [
      new RoomInvadedProblemFinder(objects),
      new OwnedRoomDecayedStructureProblemFinder(objects),
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}

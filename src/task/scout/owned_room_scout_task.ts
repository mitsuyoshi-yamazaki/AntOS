import { RoomInvadedProblemFinder } from "problem/invasion/room_invaded_problem_finder"
import { ProblemFinder } from "problem/problem_finder"
import { OwnedRoomDecayedStructureProblemFinder } from "problem/structure/owned_room_decayed_structure_problem_finder"
import { RoomName } from "utility/room_name"
import { CreateConstructionSiteTask } from "task/room_planing/create_construction_site_task"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { WorkerTask } from "task/worker/worker_task"
import { OwnedRoomObjects } from "world_info/room_info"

export interface OwnedRoomScoutTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** neighbour room names */
  n: RoomName[]
}

// TODO: まずは手動でroom.memoryを編集する
/**
 * - Owned roomの周辺の情報を取得する斥候の管理タスク
 * - 斥候の常時展開はしない
 */
export class OwnedRoomScoutTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly neighbourRoomNames: RoomName[],
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): OwnedRoomScoutTaskState {
    return {
      t: "OwnedRoomScoutTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      n: this.neighbourRoomNames,
    }
  }

  public static decode(state: OwnedRoomScoutTaskState): OwnedRoomScoutTask {
    const children = decodeTasksFrom(state.c)
    return new OwnedRoomScoutTask(state.s, children, state.r, state.n)
  }

  public static create(roomName: RoomName): OwnedRoomScoutTask {
    const neighbourRoomNames: RoomName[] = []
    const exits = Game.map.describeExits(roomName)
    for (const [, neighbour] of Object.entries(exits)) {
      neighbourRoomNames.push(neighbour)
    }
    return new OwnedRoomScoutTask(Game.time, [], roomName, neighbourRoomNames)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const problemFinders: ProblemFinder[] = []
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }
}

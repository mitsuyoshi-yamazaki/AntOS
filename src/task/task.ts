import { ProcessInfo } from "os/os"
import { ProcessId } from "process/process"
import { Position } from "utility/position"

export interface TaskExecutionCondition {
  condition: "required" | "cancellable"
  maxTickInterval: number   // maxTickIntervalに一度は必ず実行されるべき：毎tick実行する場合は1
  minTickInterval?: number  // minTickInterval以下の間隔で実行する必要はない
  currentPriority: TaskPriority
}

/**
 * - https://zenn.dev/mitsuyoshi/scraps/3917e7502ef385#comment-e0d2fee7895843
 * - Prioritize
 *   - CPU時間が余っている→全て実行
 *   - bucketを食っている→
 *     - alwaysを実行
 *     - normalの順位づけを行い、時間いっぱいまで実行→
 *       - 足りなかったら次tickへ持ち越し
 *       - 余ったら次の順位を実行→
 *         - 全て実行しても余ったらif possibleを実行
 */
export type TaskPriority = TaskPriorityIfPossible | TaskPriorityNormal | TaskPriorityAlways

// Lowest
// CPU時間が逼迫したら停止される
export interface TaskPriorityIfPossible {
  taskPriorityType: "if_possible"
}

// Medium
// CPU時間が逼迫したら実行間隔を落とされる
export interface TaskPriorityNormal {
  taskPriorityType: "normal"
}

// Highest
// 常に実行される
// TODO: lintで禁止
export interface TaskPriorityAlways {
  taskPriorityType: "always"
}

// ---- Task ---- //
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type TaskStatusType<Result, Status> = TaskStatusFinished<Result> | TaskStatusInProgress<Status> | TaskStatusFailed

export class TaskStatusFinished<Result> {
  public readonly taskStatusType = "finished"

  public constructor(public readonly result: Result) { }
}

export class TaskStatusInProgress<Status> {
  public readonly taskStatusType = "in_progress"

  public constructor(public readonly status: Status) { }
}

export class TaskStatusFailed {
  public readonly taskStatusType = "failed"

  public constructor(public readonly error: Error) { }
}


export interface Task<Obj, Result, Status> {
  processId: ProcessId
  condition: TaskExecutionCondition

  execute(obj: Obj): TaskStatusType<Result, Status>
}

// export class CreepInRoomMoveTask implements Task<Creep, void, void> {
//   public constructor(
//     public readonly processId: ProcessId,
//     public readonly destination: Position,
//     public readonly pathReuseDuration: number,
//     public readonly inRange: number,
//   ) { }

//   public execute(creep: Creep): void {
//     creep.pos
//   }
// }

// export class CreepHarvestTask implements Task {

// }

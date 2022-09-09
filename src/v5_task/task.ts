import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Stateful } from "os/infrastructure/state"
import { coloredText } from "utility/log"
import type { ProblemFinder, ProblemIdentifier } from "v5_problem/problem_finder"
import type { ProblemSolver } from "v5_problem/problem_solver"
import { OwnedRoomObjects } from "world_info/room_info"
import type { TaskState } from "./task_state"

let resetTime = Game.time
const resetInterval = 100
const taskCpuUse = new Map<string, {sum: number, count: number}>()  // <task name>, <obj>
const cpuProfiler = {
  add(name: string, cpuUse: number): void {
    if (Game.time >= resetTime + resetInterval) {
      if (taskCpuUse.size > 0) {
        const entries = Array.from(taskCpuUse.entries())
        entries.sort((lhs, rhs) => rhs[1].sum - lhs[1].sum)

        const messages: string[] = entries.map(entry => `- ${entry[1].count}times, ave: ${Math.floor((entry[1].sum / entry[1].count) * 100) / 100}: ${entry[0]}`)
        PrimitiveLogger.log(`${coloredText("[CPU]", "warn")}\n${messages.join("\n")}`)
        taskCpuUse.clear()
      }
      resetTime = Game.time
    }

    const info = ((): { sum: number, count: number } => {
      const stored = taskCpuUse.get(name)
      if (stored != null) {
        return stored
      }
      const newInfo = {
        sum: 0,
        count: 0,
      }
      taskCpuUse.set(name, newInfo)
      return newInfo
    })()

    info.count += 1
    info.sum += cpuUse
  },
}

// ---- Types and Constants ---- //
export type TaskIdentifier = string

type TaskStatusInProgress = "in progress"
type TaskStatusFinished = "finished"
type TaskStatusFailed = "failed"
const taskStatusInProgress: TaskStatusInProgress = "in progress"
const taskStatusFinished: TaskStatusFinished = "finished"
const taskStatusFailed: TaskStatusFailed = "failed"
export type TaskStatus = TaskStatusInProgress | TaskStatusFinished | TaskStatusFailed
export const TaskStatus = {
  InProgress: taskStatusInProgress,
  Finished: taskStatusFinished,
  Failed: taskStatusFailed,
}

export function isProblemSolver(task: Task): task is ProblemSolver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (task as any).problemIdentifier != null
}

export interface ChildTaskExecutionResults {
  finishedTasks: Task[]
  failedTasks: Task[]
  // unresolvableProblems: ProblemFinder[]  // TODO: 集計できていないが、子タスクで解決できなかった問題を上にあげたい
}

// ---- Interface ---- //
export abstract class Task implements Stateful {
  abstract readonly taskIdentifier: TaskIdentifier

  protected constructor(
    public readonly startTime: number,
    public readonly children: Task[],
  ) {
  }

  abstract encode(): TaskState
  abstract runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus

  public description(): string {
    return this.taskIdentifier
  }

  protected paused(): boolean {
    return false
  }

  protected checkProblemFinders(problemFinders: ProblemFinder[]): void {
    problemFinders.forEach(problemFinder => {
      if (problemFinder.problemExists() !== true) {
        return
      }
      if (this.isSolvingProblem(problemFinder.identifier)) {  // TODO: 上位タスク・下位タスクも調べる
        return
      }
      const problemSolvers = problemFinder.getProblemSolvers()
      const solver = problemSolvers[0]  // TODO: 最適なものを選択する
      if (solver == null) {
        return
      }
      this.addChildTask(solver)
    })
  }

  protected addChildTask(task: Task): void {
    if (isProblemSolver(task) && this.isSolvingProblem(task.problemIdentifier)) {
      PrimitiveLogger.fatal(`[Probram bug] Attempt to add solving problem solver ${task.problemIdentifier} to ${this.description()}`)
      return
    }
    this.children.push(task)
  }

  protected removeChildTask(task: Task): void {
    const index = this.children.indexOf(task)
    if (index < 0) {
      PrimitiveLogger.fatal(`[Program bug] Attempt to remove task ${task.description()} that is not in the list ${this.description()}`)
      return
    }
    this.children.splice(index, 1)
  }

  public run(objects: OwnedRoomObjects): TaskStatus {
    const result = ErrorMapper.wrapLoop((): TaskStatus => {
      if (this.paused() === true) {
        return TaskStatus.InProgress
      }

      this.solvingProblemIdentifiers.splice(0, this.solvingProblemIdentifiers.length)
      this.solvingProblemIdentifiers = this.children.flatMap(task => {
        if (!isProblemSolver(task)) {
          return []
        }
        return [task.problemIdentifier]
      })

      const finishedTasks: Task[] = []
      const failedTasks: Task[] = []

      const cpuUses: {name: string, cpu: number}[] = []

      this.children.forEach(task => {
        const before = Game.cpu.getUsed()
        const status = task.run(objects)
        const cpuUse = Game.cpu.getUsed() - before
        if (cpuUse > 5) {
          cpuUses.push({
            name: task.taskIdentifier,
            cpu: cpuUse,
          })

          cpuProfiler.add(task.taskIdentifier, cpuUse)
        }

        switch (status) {
        case TaskStatus.InProgress:
          return
        case TaskStatus.Finished:
          finishedTasks.push(task)
          return
        case TaskStatus.Failed:
          failedTasks.push(task)
          return
        }
      })

      if (cpuUses.length > 0) {
        console.log(`[Task] large CPU use in ${Game.time} in ${this.taskIdentifier}:\n${cpuUses.map(use => `- ${Math.floor(use.cpu * 100) / 100}, ${use.name}`).join("\n")}`)
      }

      this.removeChildTasks(finishedTasks)
      this.removeChildTasks(failedTasks)

      const result: ChildTaskExecutionResults = {
        finishedTasks,
        failedTasks,
      }

      return this.runTask(objects, result)
    }, `${this.constructor.name}.run()`)()

    if (result == null) {
      PrimitiveLogger.fatal(`${this.constructor.name}.run() throwed exception`)
      return TaskStatus.Failed
    }
    return result
  }

  // ---- Private ---- //
  private solvingProblemIdentifiers: ProblemIdentifier[] = []

  public isSolvingProblem(problemIdentifier: ProblemIdentifier): boolean {
    return this.solvingProblemIdentifiers.includes(problemIdentifier)
  }

  private removeChildTasks(tasks: Task[]): void {
    tasks.forEach(task => {
      const index = this.children.indexOf(task)
      if (index < 0) {
        return
      }
      this.children.splice(index, 1)
    })
  }
}

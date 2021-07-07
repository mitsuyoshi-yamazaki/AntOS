import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { State, Stateful } from "os/infrastructure/state"
import { ProblemFinder, ProblemIdentifier } from "problem/problem_finder"
import { isProblemSolver } from "problem/problem_solver"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskType } from "./task_decoder"

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

// ---- Interface ---- //
export interface TaskState extends State {
  /** task type identifier */
  t: TaskType

  /** start time */
  s: number

  /** child task state */
  c: TaskState[]
}

export abstract class Task implements Stateful {
  abstract readonly taskIdentifier: TaskIdentifier

  protected constructor(
    public readonly startTime: number,
    public readonly children: Task[],
  ) {
  }

  abstract encode(): TaskState
  abstract runTask(objects: OwnedRoomObjects, finishedTasks: Task[], failedTasks: Task[]): TaskStatus

  public description(): string {
    return this.taskIdentifier
  }

  protected checkProblemFinders(problemFinders: ProblemFinder[]): void {
    problemFinders.forEach(problemFinder => {
      if (problemFinder.problemExists() !== true) {
        return
      }
      if (this.isSolvingProblem(problemFinder.identifier)) {
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
    this.solvingProblemIdentifiers.splice(0, this.solvingProblemIdentifiers.length)
    this.solvingProblemIdentifiers = this.children.flatMap(task => {
      if (!isProblemSolver(task)) {
        return []
      }
      return [task.problemIdentifier]
    })

    const finishedTasks: Task[] = []
    const failedTasks: Task[] = []

    this.children.forEach(task => {
      const status = task.run(objects)
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

    this.removeChildTasks(finishedTasks)
    this.removeChildTasks(failedTasks)

    return this.runTask(objects, finishedTasks, failedTasks)
  }

  // ---- Private ---- //
  private solvingProblemIdentifiers: ProblemIdentifier[] = []

  private isSolvingProblem(problemIdentifier: ProblemIdentifier): boolean {
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

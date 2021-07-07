import { Task, TaskIdentifier, TaskState } from "task/task"
import { ProblemIdentifier } from "./problem_finder"

export interface ProblemSolverState extends TaskState {
  /** problem identifier */
  i: ProblemIdentifier
}

export abstract class ProblemSolver extends Task {
  public get taskIdentifier(): TaskIdentifier {
    return this.problemIdentifier
  }

  protected constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly problemIdentifier: ProblemIdentifier,
  ) {
    super(startTime, children)
  }

  public description(): string {
    const descriptions: string[] = [this.constructor.name]
    descriptions.push(this.problemIdentifier)
    return descriptions.join("_")
  }
}

export function isProblemSolver(task: Task): task is ProblemSolver {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (task as any).problemIdentifier != null
}

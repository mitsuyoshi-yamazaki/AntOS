import type { AnyTaskProblem } from "./any_problem"
import type { Task } from "./task"
import type { TaskPerformance } from "./task_profit"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTask<Performance extends TaskPerformance> = Task<any, AnyTaskProblem, Performance>

import type { AnyTaskProblem } from "./any_problem"
import type { Task } from "./task"
import type { TaskPerformance, TaskPerformanceState } from "./task_profit"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTask<Performance extends TaskPerformance, PerformanceState extends TaskPerformanceState> = Task<any, AnyTaskProblem, Performance, PerformanceState>

import type { TaskIdentifier } from "./task_identifier"

export type ProblemIdentifier = string

export interface Problem {
  identifier: ProblemIdentifier
  taskIdentifier: TaskIdentifier
}

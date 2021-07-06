import { ProblemSolver } from "./problem_solver"

export type ProblemIdentifier = string

export interface Problem {
  identifier: ProblemIdentifier

  getProblemSolvers(): ProblemSolver[]
}

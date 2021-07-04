import { ProblemSolver } from "./problem_solver"

export type ProblemIdentifier = string

export interface Problem {
  identifier: ProblemIdentifier
  problemSolver: ProblemSolver  // TODO: 複数のSolverから選択できるようにする: 現在選択中のSolverを保存する必要がある
}

import { TaskIdentifier } from "task/task"
import { ProblemSolver } from "./problem_solver"

export type ProblemIdentifier = TaskIdentifier

/**
 * - Taskから直接子Taskを追加しても良いが、複数の選択肢がある場合や同一性判定を行う場合はProblemにする
 */
export interface ProblemFinder {
  identifier: ProblemIdentifier

  problemExists(): boolean
  getProblemSolvers(): ProblemSolver[]
}

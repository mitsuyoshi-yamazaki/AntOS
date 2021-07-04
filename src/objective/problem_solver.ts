import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { State, Stateful } from "os/infrastructure/state"
import { CreepInsufficiencyProblemSolver, CreepInsufficiencyProblemSolverState } from "./creep_existence/creep_insufficiency_problem_solver"
import { ProblemIdentifier } from "./problem"
import { TaskRunner } from "./task_runner"

export interface ProblemSolverState extends State {
  /** type identifier */
  t: keyof ProblemSolverDecoderMap

  /** problem identifier */
  p: ProblemIdentifier
}

export interface ProblemSolver extends Stateful, TaskRunner {
  problemIdentifier: ProblemIdentifier

  encode(): ProblemSolverState
  run(): void
}

class ProblemSolverDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "CreepInsufficiencyProblemSolver" = (state: ProblemSolverState) => CreepInsufficiencyProblemSolver.decode(state as CreepInsufficiencyProblemSolverState)
}
const decoderMap = new ProblemSolverDecoderMap()

export function decodeProblemSolverFromState(state: ProblemSolverState): ProblemSolver | null {
  const result = ErrorMapper.wrapLoop((): ProblemSolver | null => {
    const decoder = decoderMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (problem solver type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
      return null
    }
    return decoder(state)
  }, `decodeProblemSolverFromState(), objective type: ${state.t}`)()

  if (result == null) {
    const message = `Decode failed by program bug (problem solver type identifier: ${state.t})`
    PrimitiveLogger.fatal(message)
    return null
  }
  return result
}

export function decodeProblemSolvers(states: ProblemSolverState[]): ProblemSolver[] {
  return states.reduce((result, current) => {
    const solver = decodeProblemSolverFromState(current)
    if (solver != null) {
      result.push(solver)
    }
    return result
  }, [] as ProblemSolver[])
}

import { State, Stateful } from "os/infrastructure/state"
import { CreepName } from "prototype/creep"
import { World } from "world_info/world_info"


export class ProblemSolverStatusResolving {
  public readonly ProblemSolverStatusType = "resolving"
}

export class ProblemSolverStatusResolved<T> {
  public readonly ProblemSolverStatusType = "resolved"

  public constructor(
    public readonly value: T
  ) { }
}

export class ProblemSolverStatusUnsolvable<T> {
  public readonly ProblemSolverStatusType = "unsolvable"

  public constructor(
    public readonly value: T
  ) { }
}

type ProblemSolverStatus<T, S> = ProblemSolverStatusResolving | ProblemSolverStatusResolved<T> | ProblemSolverStatusUnsolvable<S>

export interface ProblemSolverState extends State {

}

export interface ProblemSolver<T, S> extends Stateful {
  currentStatus(): ProblemSolverStatus<T, S>
}

export interface Cancellable {
  cancel(): void
}

/**
 * - 具体的なタスクをアサインできる = GameObjectの参照をもつProblemSolver
 * - GameObject"が"解決する、のではなくGameObject"で"解決する。そのため解決した際には不要になったGameObjectを返却する
 *   - →参照をもっておけば良いのでは？
 *
*/
export interface ConcreteProblemSolver<GameObject, S> extends ProblemSolver<GameObject, S> {

}

export interface CreepProblemSolver<S> extends ConcreteProblemSolver<Creep, S> {

}

function hoge(): void {
  const creepName: CreepName = "test"
  const creep = World.creeps.get(creepName)
  let problemSolver = "" as unknown as CreepInsufficiencySolver | null

  if (creep == null) {
    if (problemSolver == null) {
      const problem = new CreepInsufficiencyProblem([MOVE])
      problemSolver = problem.possibleSolutions()[0]
    } else {
      const result = problemSolver.run()
    }

  }
}

export class CreepInsufficiencyProblem {
  public constructor(
    private readonly body: BodyPartConstant[],
  ) {}

  public possibleSolutions(): ProblemSolver[] {
    return [
      new CreepInsufficiencySolver()
    ]
  }

  public assignSolution(solution: ProblemSolver): void {

  }
}

export class CreepInsufficiencySolver implements CreepProblemSolver<void>, Cancellable {
  private readonly creepName: CreepName = "test"

  public run(): ProblemSolverStatus<Creep, void> {
    const creep = World.creeps.get(this.creepName)
    if (creep == null) {
      return new ProblemSolverStatusResolving()
    }
    return new ProblemSolverStatusResolved(creep)

    // Spawnに不都合があるとunsolvableになる
  }

  public cancel(): void {

  }
}

// ----

export class ObserveRoomProblemSolver implements ProblemSolver {
  public currentStatus(): ProblemSolverStatus<T, S> {

  }
}

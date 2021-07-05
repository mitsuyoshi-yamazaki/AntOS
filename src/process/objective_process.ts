import { LaunchableObjectiveType, Objective } from "objective/objective"
import { ObjectiveRunner, ObjectiveRunnerState } from "objective/objective_runner"
import { Problem, ProblemIdentifier } from "objective/problem"
import { decodeProblemSolvers, ProblemSolver } from "objective/problem_solver"
import { TaskRunner } from "objective/task_runner"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessId, processLog, ProcessState, ProcessTypeIdentifier } from "process/process"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"

export interface ObjectiveProcessState extends ProcessState, ObjectiveRunnerState {
  /** type identifier */
  t: ProcessTypeIdentifier
}

export class ObjectiveProcess extends ObjectiveRunner implements Process {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    protected readonly objectiveTypes: LaunchableObjectiveType[],
    protected problemSolvers: ProblemSolver[],
    public readonly roomName: RoomName,
  ) {
    super(objectiveTypes, problemSolvers, roomName)
  }

  public encode(): ObjectiveProcessState {
    return {
      t: "ObjectiveProcess",
      l: this.launchTime,
      i: this.processId,
      o: this.objectiveTypes,
      s: this.problemSolvers.map(solver => solver.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: ObjectiveProcessState): ObjectiveProcess {
    const problemSolvers = decodeProblemSolvers(state.s)
    return new ObjectiveProcess(state.l, state.i, state.o, problemSolvers, state.r)
  }

  public static create(processId: ProcessId, roomName: RoomName): ObjectiveProcess {
    return new ObjectiveProcess(Game.time, processId, [], [], roomName)
  }

  // ---- ObjectiveRunner ---- //
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public didListupObjectives(objectives: Objective[]): void {
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public didListupTaskRunners(taskRunners: TaskRunner[]): void {
  }

  public didResolveProblems(resolvedProblemSolvers: ProblemSolver[]): void {
    if (resolvedProblemSolvers.length <= 0) {
      return
    }
    this.log(`Resolved:\n  - ${resolvedProblemSolvers.map(solver => solver.problemIdentifier).join("\n  - ")}`)
  }

  public didOccurProblems(newProblems: Problem[]): void {
    if (newProblems.length <= 0) {
      return
    }
    this.log(`New problems:\n  - ${newProblems.map(problem => problem.identifier).join("\n  - ")}`)
  }

  public isWorkingFine(): void {
    this.log(`${roomLink(this.roomName)} working fine 😀`)
  }

  public chooseProblemSolver(problem: Problem): ProblemSolver | null {
    return problem.getProblemSolvers()[0]
  }

  public log(message: string): void {
    processLog(this, message)
  }

  private updateProblemSolvers(currentProblems: Problem[]): void {
    const problemMap = new Map<ProblemIdentifier, Problem>()
    currentProblems.forEach(problem => {
      problemMap.set(problem.identifier, problem)
    })

    // 解決した問題をフィルタ
    const allProblemIdentifiers = Array.from(problemMap.values()).map(problem => problem.identifier)
    this.problemSolvers = this.problemSolvers.filter(solver => allProblemIdentifiers.includes(solver.problemIdentifier))

    // 現在実行中の問題をフィルタ
    this.problemSolvers.forEach(solver => problemMap.delete(solver.problemIdentifier))

    Array.from(problemMap.values()).forEach(problem => {
      const solvers = problem.getProblemSolvers()
      if (solvers[0] == null) {
        PrimitiveLogger.fatal(`HELP! problem ${problem.identifier} has no solutions`)
        return
      }
      this.problemSolvers.push(solvers[0])    // TODO: 選択する
    })
  }
}

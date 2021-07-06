import { LaunchableObjectiveType, Objective } from "objective/objective"
import { ObjectiveRunner, ObjectiveRunnerState } from "objective/objective_runner"
import { Problem } from "objective/problem"
import { decodeProblemSolvers, ProblemSolver } from "objective/problem_solver"
import { TaskRunner } from "objective/task_runner"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessId, processLog, ProcessState, ProcessTypeIdentifier } from "process/process"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { OwnedRoomObjects } from "world_info/room_info"

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
  public predefinedObjectives(objects: OwnedRoomObjects): Objective[] {
    return []
  }

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
    const solver = problem.getProblemSolvers()[0]
    if (solver == null) {
      PrimitiveLogger.fatal(`HELP! problem ${problem.identifier} has no solutions`)
      return null
    }
    return solver
  }

  public log(message: string): void {
    processLog(this, message)
  }
}

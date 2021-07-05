import { ClaimRoomObjective } from "objective/claim_room/claim_room_objective"
import { LaunchableObjectiveType, Objective } from "objective/objective"
import { ObjectiveRunner, ObjectiveRunnerState } from "objective/objective_runner"
import { Problem } from "objective/problem"
import { decodeProblemSolvers, ProblemSolver } from "objective/problem_solver"
import { TaskRunner } from "objective/task_runner"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { Process, ProcessId, processLog, ProcessState, ProcessTypeIdentifier } from "process/process"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"

export interface ClaimRoomProcessState extends ProcessState, ObjectiveRunnerState {
  /** type identifier */
  t: ProcessTypeIdentifier

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]
}

// Game.io("launch ClaimRoomProcess -l target_room_name=W57S27 waypoints=W53S30,W55S29,W56S28")
export class ClaimRoomProcess extends ObjectiveRunner implements Process {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    protected readonly objectiveTypes: LaunchableObjectiveType[],
    protected problemSolvers: ProblemSolver[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
  ) {
    super(objectiveTypes, problemSolvers, roomName)
  }

  public encode(): ClaimRoomProcessState {
    return {
      t: "ClaimRoomProcess",
      l: this.launchTime,
      i: this.processId,
      o: this.objectiveTypes,
      s: this.problemSolvers.map(solver => solver.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
      w: this.waypoints ?? [],
    }
  }

  public static decode(state: ClaimRoomProcessState): ClaimRoomProcess {
    const problemSolvers = decodeProblemSolvers(state.s)
    return new ClaimRoomProcess(state.l, state.i, state.o, problemSolvers, state.r, state.tr, state.w)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): ClaimRoomProcess {
    return new ClaimRoomProcess(Game.time, processId, [], [], roomName, targetRoomName, waypoints)
  }

  // ---- ObjectiveRunner ---- //
  public predefinedObjectives(objects: OwnedRoomObjects): Objective[] {
    return [
      new ClaimRoomObjective(objects, this.targetRoomName, this.waypoints),
    ]
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
    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom != null && targetRoom.controller != null && targetRoom.controller.my === true) {
      this.log(`${roomLink(this.targetRoomName)} successfully claimed. terminating...`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }
    this.log(`${roomLink(this.targetRoomName)} working fine 😀`)
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

import { Problem, ProblemIdentifier } from "objective/problem"
import { decodeProblemSolvers, ProblemSolver, ProblemSolverState } from "objective/problem_solver"
import { TaskRunner } from "objective/task_runner"
import { UpgradeControllerObjective } from "objective/upgrade_controller/upgrade_controller_objective"
import { Procedural } from "old_objective/procedural"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessId, processLog, ProcessState } from "process/process"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"

export interface LowRCLRoomKeeperProcessState extends ProcessState {
  /** problem solver state */
  s: ProblemSolverState[]

  /** room name */
  r: RoomName
}

export class LowRCLRoomKeeperProcess implements Process, Procedural {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private problemSolvers: ProblemSolver[],
    public readonly roomName: RoomName,
  ) {
  }

  public encode(): LowRCLRoomKeeperProcessState {
    return {
      t: "LowRCLRoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.problemSolvers.map(solver => solver.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: LowRCLRoomKeeperProcessState): LowRCLRoomKeeperProcess {
    const problemSolvers = decodeProblemSolvers(state.s)
    return new LowRCLRoomKeeperProcess(state.l, state.i, problemSolvers, state.r)
  }

  public static create(processId: ProcessId, roomName: RoomName): LowRCLRoomKeeperProcess {
    return new LowRCLRoomKeeperProcess(Game.time, processId, [], roomName)
  }

  public processShortDescription(): string {
    return roomLink(this.roomName)
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.roomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`Room ${roomLink(this.roomName)} lost`)
      return
    }

    const objective = new UpgradeControllerObjective(objects)
    const status = objective.currentStatus()
    switch (status.objectiveStatus) {
    case "achieved":
      processLog(this, `Room ${roomLink(this.roomName)} working fine 😀`)
      this.problemSolvers = []
      break
    case "not achieved":
      this.updateProblemSolvers(status.problems)
      break
    }

    // TODO: taskRunnersとも重複を除く
    this.runTasks(objective.taskRunners(), this.problemSolvers)
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

  private runTasks(taskRunners: TaskRunner[], problemSolvers: ProblemSolver[]): void {
    taskRunners.forEach(taskRunner => taskRunner.run())

    if (problemSolvers.length <= 0) {
      return
    }
    processLog(this, `Room ${roomLink(this.roomName)} has following problems:\n  - ${problemSolvers.map(p => p.problemIdentifier).join("\n  - ")}`)
    problemSolvers.forEach(solver => solver.run())
  }
}

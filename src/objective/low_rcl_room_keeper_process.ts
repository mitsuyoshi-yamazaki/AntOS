import { Procedural } from "old_objective/procedural"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Process, ProcessId, processLog, ProcessState } from "process/process"
import { RoomName } from "prototype/room"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { Problem } from "./problem"
import { UpgradeControllerObjective } from "./upgrade_controller/upgrade_controller_objective"

export interface LowRCLRoomKeeperProcessState extends ProcessState {
  /** room name */
  r: RoomName
}

/**
 * - creep管理を永続化する必要がないためProblem, TaskRunnerも永続化する必要がない？
 *   - →その場合は毎tick生成する = Problemは自動で解決する
 */
export class LowRCLRoomKeeperProcess implements Process, Procedural {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
  ) {

  }

  public encode(): LowRCLRoomKeeperProcessState {
    return {
      t: "LowRCLRoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.roomName,
    }
  }

  public static decode(state: LowRCLRoomKeeperProcessState): LowRCLRoomKeeperProcess {
    return new LowRCLRoomKeeperProcess(state.l, state.i, state.r)
  }

  public static create(processId: ProcessId, roomName: RoomName): LowRCLRoomKeeperProcess {
    return new LowRCLRoomKeeperProcess(Game.time, processId, roomName)
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
      break
    case "not achieved":
      this.solveProblems(status.problems)
      break
    }

    objective.taskRunners().forEach(taskRunner => taskRunner.run())
  }

  private solveProblems(problems: Problem[]): void {
    const problemSet: Problem[] = []
    problems.forEach(problem => {
      if (problemSet.some(p => p.identifier === problem.identifier) !== true) {
        problemSet.push(problem)
      }
    })

    processLog(this, `Room ${roomLink(this.roomName)} has following problems: ${problemSet.map(p => p.identifier)}`)
    problemSet.forEach(problem => {
      problem.problemSolver.run()
    })
  }
}

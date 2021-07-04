import { Procedural } from "old_objective/procedural"
import { Process, ProcessId, ProcessState } from "process/process"
import { RoomName } from "prototype/room"
import { World } from "world_info/world_info"

export interface LowRCLRoomKeeperProcessState extends ProcessState {

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
    }
  }

  public runOnTick(): void {
    const problems: Problem[] = []
    const taskRunners: TaskRunner[] = []



    const objective = this.currentObjective()
    if (objective == null) {
      return
    }

    if (objective !== this.storedObjective) { // TODO: 何らかの方法で判定する
      // TODO:
      return
    }

    this.problems = []
    const status = objective.currentStatus()
    switch (status.objectiveStatus) {
    case "achieved":
      break
    case "not achieved":
      this.problems.push(...status.problems)
      break
    }

    // problem solverをrunする
  }

  private currentObjective(): Objective | null {
    const room = World.rooms.get(this.roomName)
    if (room == null || room.controller == null) {
      return null // TODO:
    }

    switch (room.controller.level) {
    case 1:
    case 2:
      return new LowRCLObjective()
    default:
      return null // TODO:
    }

  }
}

// ----

/**
 * - Objective: RCL1 -> RCL2
 *   - lack of worker
 *   - lack of Energy
 *     - need harvesting
 *       - need worker
 *         - need Energy
 */
// Creepは所属を明確にするのではなくリソースプールに共有したらどうか
// 時分割でタスクが変わることをメタタスク内に情報として持てないか

interface Objective {
  currentStatus(): ObjectiveStatus
}

type ProblemIdentifier = string

interface Problem {
  identifier: ProblemIdentifier
}

class ObjectiveStatusNotAchieved {
  objectiveStatus = "not achieved"

  public constructor(public readonly problems: Problem[]) { }
}

class ObjectiveStatusAchieved {
  objectiveStatus = "achieved"
}

type ObjectiveStatus = ObjectiveStatusAchieved | ObjectiveStatusNotAchieved

class CreepInsufficiencyProblem implements Problem {
  public readonly identifier = this.constructor.name
}

class EnergyInsufficiencyProblem implements Problem {
  public readonly identifier = this.constructor.name
}

/**
 * - 同じ問題が複数のsituationで発生する、もしくはproblemが循環するなどの事象があるので、problemはまとめておいて同時に解決させる
 *   - →まとめられるproblemをidentifierで判定する
 */
class LowRCLObjective implements Objective {
  public currentStatus(): ObjectiveStatus {
    return new ObjectiveStatusNotAchieved([new CreepInsufficiencyProblem()])
  }
}

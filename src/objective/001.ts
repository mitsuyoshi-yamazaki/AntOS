
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

interface Problem {
}

class ObjectiveStatusNotAchieved<T extends Problem> {
  objectiveStatus = "not achieved"

  public constructor(public readonly problems: T[]) { }
}

class ObjectiveStatusAchieved {
  objectiveStatus = "achieved"
}

type ObjectiveStatus<T extends Problem> = ObjectiveStatusAchieved | ObjectiveStatusNotAchieved<T>

class CreepInsufficiencyProblem implements Problem {

}

class EnergyInsufficiencyProblem implements Problem {

}

type RCL2ObjectiveProblemType = CreepInsufficiencyProblem | EnergyInsufficiencyProblem

/**
 * - 同じ問題が複数のsituationで発生する、もしくはproblemが循環するなどの事象があるので、problemはまとめておいて同時に解決させる
 *   - →まとめられるproblemをidentifierで判定する
 */
class RCL2Objective {
  public currentStatus(): ObjectiveStatus<RCL2ObjectiveProblemType> {
    return new ObjectiveStatusNotAchieved([new CreepInsufficiencyProblem()])
  }
}



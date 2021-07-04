import { Procedural } from "old_objective/procedural"
import { CreepName } from "prototype/creep"
import { RoomName } from "prototype/room"
import { World } from "world_info/world_info"

interface TaskRunner {
  problem: Problem

  run(): "in progress" | "finished" | "failed"
}

/** ただのalias */
type ProblemSolver = TaskRunner

type ProblemIdentifier = string

interface Problem {
  /** problem identifier: 同じ問題かどうか判定するためのもの */
  identifier: ProblemIdentifier
  parent: Problem | null
}

/**
 * - [ ] ObjectiveとSituationをもつ主体は誰か？
 * - Objectiveが達成できたらSituationに移行する
 * - 優先順位はSituation > Objective
 * - 条件以外は構造化する→人間は条件定義のみ行う
 */
interface Objective {
  problems: ProblemIdentifier[]
  taskRunners: TaskRunner[]
}

/**
 * - Room Keeper
 *   - workerが働いている
 *   - sourceからharvestしている
 */
type Situation = Objective

class RoomObservingSituation implements Situation {
  public readonly problems: ProblemIdentifier[] = []
  public readonly taskRunners: TaskRunner[] = []

  public constructor(
    public readonly targetRoomName: RoomName,
  ) { }

  public run(): void {
    this.updateTaskRunner()

  }

  private updateTaskRunner(): void {
    const finishedTaskRunners: TaskRunner[] = []
    const failedTaskRunners: TaskRunner[] = []

    this.taskRunners.forEach(taskRunner => {
      const result = taskRunner.run()
      switch (result) {
      case "in progress":
        return
      case "finished":
        finishedTaskRunners.push(taskRunner)
        return
      case "failed":
        failedTaskRunners.push(taskRunner)
        return
      }
    })

    // TaskRunnerの状態はProblemの状態と連動しているべきで、個別でチェックするべきではない
  }

  private checkCurrentSituation(): void {
    const targetRoom = World.rooms.get(this.targetRoomName)

  }
}

class ScoutInRoomSituation implements Situation {
  public constructor(
    public readonly scoutName: CreepName,
  ) { }


}

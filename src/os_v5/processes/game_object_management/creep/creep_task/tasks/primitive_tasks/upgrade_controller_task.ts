import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { GameConstants } from "utility/constants"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type UpgradeControllerState = {
  readonly t: TaskTypeEncodingMap["UpgradeController"]
  readonly tg: Id<StructureController>
}

export class UpgradeController extends Task<UpgradeControllerState> {
  public readonly actionType = "upgradeController"

  private constructor(
    public readonly targetId: Id<StructureController>,
  ) {
    super()
  }

  public static decode(state: UpgradeControllerState): UpgradeController {
    return new UpgradeController(state.tg)
  }

  public static create(targetId: Id<StructureController>): UpgradeController {
    return new UpgradeController(targetId)
  }

  public encode(): UpgradeControllerState {
    return {
      t: "g",
      tg: this.targetId,
    }
  }

  public run(creep: AnyV5Creep): TaskResult {
    const target = Game.getObjectById(this.targetId)
    if (target == null) {
      return "failed"
    }
    if (creep.upgradeController(target) === OK) {
      creep.executedActions.add(this.actionType)

      const upgradePower = creep.body.filter(body => body.type === WORK).length * GameConstants.creep.actionPower.upgradeController
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= upgradePower) {
        return "finished"
      }
      return "in progress"
    }
    return "failed"
  }
}

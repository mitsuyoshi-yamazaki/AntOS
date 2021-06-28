import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface UpgradeControllerTaskState extends CreepTaskState {
  /** target id */
  i: Id<StructureController>
}

export class UpgradeControllerTask implements CreepTask {
  public readonly taskType = "UpgradeControllerTask"
  public readonly shortDescription = "upgrade"
  public get targetId(): Id<StructureController> {
    return this.controller.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly controller: StructureController,
  ) { }

  public encode(): UpgradeControllerTaskState {
    return {
      s: this.startTime,
      t: "UpgradeControllerTask",
      i: this.controller.id,
    }
  }

  public static decode(state: UpgradeControllerTaskState): UpgradeControllerTask | null {
    const controller = Game.getObjectById(state.i)
    if (controller == null) {
      return null
    }
    return new UpgradeControllerTask(state.s, controller)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    const result = creep.upgradeController(this.controller)

    switch (result) {
    case OK: {
      const consumeAmount = creep.body.filter(b => b.type === WORK).length * UPGRADE_CONTROLLER_POWER
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= consumeAmount) {
        return "finished"
      }
      this.move(creep)
      return "in progress"
    }
    case ERR_NOT_IN_RANGE:
      this.move(creep)
      return "in progress"
    case ERR_NOT_ENOUGH_RESOURCES:
      return "finished"
    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
      return "failed"
    case ERR_BUSY:
    default:
      return "in progress"
    }
  }

  private move(creep: Creep): void {
    const range = creep.pos.getRangeTo(this.controller.pos)
    if (range <= 2) {
      return
    }
    const reusePath = creep.pos.getRangeTo(this.controller.pos) <= 3 ? CREEP_LIFE_TIME : 15
    creep.moveTo(this.controller, { reusePath })
  }
}

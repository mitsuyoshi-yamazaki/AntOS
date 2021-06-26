import { GameObjectTask, GameObjectTaskState, GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface UpgradeControllerTaskState extends GameObjectTaskState {
  /** target id */
  i: Id<StructureController>
}

export class UpgradeControllerTask implements GameObjectTask<Creep> {
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
      return "in progress"
    }
    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.controller, { reusePath: 15 })
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
}

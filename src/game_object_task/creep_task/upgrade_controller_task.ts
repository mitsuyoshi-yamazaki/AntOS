import { GameObjectTask, GameObjectTaskState, GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface UpgradeControllerTaskState extends GameObjectTaskState {
  /** target id */
  i: Id<StructureController>
}

export class UpgradeControllerTask implements GameObjectTask<Creep> {
  public readonly taskType = "UpgradeControllerTask"

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
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      return "finished"
    }

    const result = creep.upgradeController(this.controller)
    switch (result) {
    case OK:
      return "in progress"
    default:
      creep.moveTo(this.controller, { reusePath: 15 })
      return "in progress"
    }
  }
}

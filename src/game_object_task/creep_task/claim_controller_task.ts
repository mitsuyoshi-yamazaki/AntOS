import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface ClaimControllerTaskState extends CreepTaskState {
  /** target controller ID */
  i: Id<StructureController>
}

export class ClaimControllerTask implements CreepTask {
  public readonly shortDescription = "claim"
  public get targetId(): Id<StructureController> {
    return this.controller.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly controller: StructureController,
  ) { }

  public encode(): ClaimControllerTaskState {
    return {
      s: this.startTime,
      t: "ClaimControllerTask",
      i: this.controller.id,
    }
  }

  public static decode(state: ClaimControllerTaskState): ClaimControllerTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new ClaimControllerTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    if (creep.pos.roomName !== this.controller.pos.roomName) {
      creep.moveToRoom(this.controller.room.name)
      return "in progress"
    }
    const result = creep.claimController(this.controller)

    switch (result) {
    case OK:
      return "finished"
    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.controller, { reusePath: 15 })
      return "in progress"

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    case ERR_FULL:
    case ERR_GCL_NOT_ENOUGH:
      return "failed"

    case ERR_BUSY:
    default:
      return "in progress"
    }
  }
}

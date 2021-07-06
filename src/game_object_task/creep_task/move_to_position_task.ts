import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface MoveToPortalTaskState extends CreepTaskState {
  /** target id */
  i: Id<StructurePortal>
}

export class MoveToPortalTask implements CreepTask {
  public readonly shortDescription = "move"
  public get targetId(): Id<StructurePortal> {
    return this.portal.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly portal: StructurePortal,
  ) { }

  public encode(): MoveToPortalTaskState {
    return {
      s: this.startTime,
      t: "MoveToPortalTask",
      i: this.portal.id,
    }
  }

  public static decode(state: MoveToPortalTaskState): MoveToPortalTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new MoveToPortalTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {

    const result = creep.moveTo(this.portal, {reusePath: 0})

    switch (result) {
    case OK: {
      if (creep.pos.isNearTo(this.portal.pos) === true) {
        return "finished"
      }
      return "in progress"
    }
    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
      return "failed"

    case ERR_BUSY:
    case ERR_NO_PATH:
    case ERR_NOT_FOUND:
    case ERR_TIRED:
    default:
      return "in progress"
    }
  }
}

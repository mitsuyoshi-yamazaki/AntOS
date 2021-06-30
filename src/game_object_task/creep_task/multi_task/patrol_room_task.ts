import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { AttackTask } from "../attack_task"
import { RangedAttackTask } from "../ranged_attack_task"

type PatrolRoomTaskConcreteTaskType = AttackTask | RangedAttackTask

export interface PatrolRoomTaskState extends CreepTaskState {
  /** target id */
  i: Id<ConstructionSite<BuildableStructureConstant>>
}

export class PatrolRoomTask implements CreepTask {
  public readonly shortDescription = "patrol"
  public get targetId(): Id<ConstructionSite<BuildableStructureConstant>> {
    return this.constructionSite.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly concreteTask: ConstructionSite<BuildableStructureConstant>,
  ) { }

  public encode(): PatrolRoomTaskState {
    return {
      s: this.startTime,
      t: "PatrolRoomTask",
      i: this.constructionSite.id,
    }
  }

  public static decode(state: PatrolRoomTaskState): PatrolRoomTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new PatrolRoomTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    creep.memory.tt = Game.time
    const result = creep.build(this.constructionSite)

    switch (result) {
      case OK: {
        const consumeAmount = creep.body.filter(b => b.type === WORK).length * BUILD_POWER
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= consumeAmount) {
          return "finished"
        }
        return "in progress"
      }
      case ERR_NOT_IN_RANGE:
        creep.moveTo(this.constructionSite, { reusePath: 0 })
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

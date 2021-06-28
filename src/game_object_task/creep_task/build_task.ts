import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface BuildTaskState extends CreepTaskState {
  /** target id */
  i: Id<ConstructionSite<BuildableStructureConstant>>
}

export class BuildTask implements CreepTask {
  public readonly taskType = "BuildTask"
  public readonly shortDescription = "build"
  public get targetId(): Id<ConstructionSite<BuildableStructureConstant>> {
    return this.constructionSite.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly constructionSite: ConstructionSite<BuildableStructureConstant>,
  ) { }

  public encode(): BuildTaskState {
    return {
      s: this.startTime,
      t: "BuildTask",
      i: this.constructionSite.id,
    }
  }

  public static decode(state: BuildTaskState): BuildTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new BuildTask(state.s, target)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
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
      creep.moveTo(this.constructionSite, { reusePath: 15 })
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

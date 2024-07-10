import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { GameConstants } from "utility/constants"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type BuildState = {
  readonly t: TaskTypeEncodingMap["Build"]
  readonly c: Id<ConstructionSite<BuildableStructureConstant>>  /// Construction site ID
}

export class Build extends Task<BuildState> {
  public readonly actionType = "build"

  private constructor(
    public readonly constructionSiteId: Id<ConstructionSite<BuildableStructureConstant>>,
  ) {
    super()
  }

  public static decode(state: BuildState): Build {
    return new Build(state.c)
  }

  public static create(constructionSiteId: Id<ConstructionSite<BuildableStructureConstant>>): Build { // signを消去するには空文字列を入れる
    return new Build(constructionSiteId)
  }

  public encode(): BuildState {
    return {
      t: "k",
      c: this.constructionSiteId,
    }
  }

  public run(creep: AnyV5Creep): TaskResult {
    const constructionSite = Game.getObjectById(this.constructionSiteId)
    if (constructionSite == null) {
      return "failed"
    }

    const energy = creep.store.getUsedCapacity(RESOURCE_ENERGY)
    if (energy <= 0) {
      return "finished"
    }

    const result = creep.build(constructionSite)
    switch (result) {
    case OK: {
      const buildPower = creep.body.filter(body => body.type === WORK).length * GameConstants.creep.actionPower.build
      creep.executedActions.add(this.actionType)
      if (buildPower >= energy) {
        return "finished"
      }
      return "in progress"
    }

    case ERR_RCL_NOT_ENOUGH:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_TIRED:
    case ERR_BUSY:
    case ERR_NOT_IN_RANGE:
    case ERR_INVALID_TARGET:
    case ERR_NO_BODYPART:
    case ERR_NOT_OWNER:
      return "failed"

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      return "failed"
    }
    }
  }
}

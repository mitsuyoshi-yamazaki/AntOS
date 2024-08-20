import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { GameConstants } from "utility/constants"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"

type BuildState = {
  readonly t: TaskTypeEncodingMap["Build"]
  readonly c: Id<ConstructionSite<BuildableStructureConstant>>  /// Construction site ID
}

export type BuildResult = void
export type BuildError = Exclude<ReturnType<Creep["build"]>, OK> | "no_construction_site"


export class Build extends Task<BuildState, BuildResult, BuildError> {
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

  public run(creep: AnyV5Creep): TaskResult<BuildResult, BuildError> {
    const constructionSite = Game.getObjectById(this.constructionSiteId)
    if (constructionSite == null) {
      return {
        case: "failed",
        taskType: "Build",
        error: "no_construction_site",
      }
    }

    const energy = creep.store.getUsedCapacity(RESOURCE_ENERGY)
    if (energy <= 0) {
      return {
        case: "finished",
        taskType: "Build",
        result: undefined,
      }
    }

    const result = creep.build(constructionSite)
    if (result === OK) {
      const buildPower = creep.body.filter(body => body.type === WORK).length * GameConstants.creep.actionPower.build
      creep.executedActions.add(this.actionType)
      if (buildPower >= energy) {
        return {
          case: "finished",
          taskType: "Build",
          result: undefined,
        }
      }
      return {
        case: "in_progress",
      }
    }

    return {
      case: "failed",
      taskType: "Build",
      error: result,
    }
  }
}

import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"
import { storedResourceTypes } from "shared/utility/store"

type DropAllResourcesState = {
  readonly t: TaskTypeEncodingMap["DropAllResources"]
}

export type DropAllResourcesResult = void
export type DropAllResourcesError = Exclude<ReturnType<Creep["drop"]>, OK>


export class DropAllResources extends Task<DropAllResourcesState, DropAllResourcesResult, DropAllResourcesError> {
  public readonly actionType = "drop"

  private constructor(
  ) {
    super()
  }

  public static decode(): DropAllResources {
    return new DropAllResources()
  }

  public static create(): DropAllResources {
    return new DropAllResources()
  }

  public encode(): DropAllResourcesState {
    return {
      t: "j",
    }
  }

  public run(creep: AnyV5Creep): TaskResult<DropAllResourcesResult, DropAllResourcesError> {
    const storedResources = storedResourceTypes(creep.store)

    storedResources.forEach(resourceType => {
      creep.drop(resourceType)
    })
    return {
      case: "finished",
      taskType: "DropAllResources",
      result: undefined,
    }
  }
}

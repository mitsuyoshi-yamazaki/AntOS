import { AnyV5Creep } from "os_v5/utility/game_object/creep"
import { Task, TaskResult, TaskTypeEncodingMap } from "../../types"
import { storedResourceTypes } from "shared/utility/store"

type DropAllResourcesState = {
  readonly t: TaskTypeEncodingMap["DropAllResources"]
}

export class DropAllResources extends Task<DropAllResourcesState> {
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

  public run(creep: AnyV5Creep): TaskResult {
    const storedResources = storedResourceTypes(creep.store)

    storedResources.forEach(resourceType => {
      creep.drop(resourceType)
    })
    return "finished"
  }
}

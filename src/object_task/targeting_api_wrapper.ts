import { V6Creep } from "prototype/creep"
import { TaskTarget, TaskTargetType } from "./object_task_target_cache"

// export type TargetingApiWrapperTargetType = AnyCreep | Resource | Tombstone | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>

export interface TargetingApiWrapper {
  target: TaskTargetType
  range: number

  taskTarget(creep: V6Creep): TaskTarget
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isTargetingApiWrapper(arg: any): arg is TargetingApiWrapper {
  return arg.target != null && arg.target.id != null
}

export type TargetingApiWrapperTargetType = AnyCreep | Resource | Tombstone | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>

export interface TargetingApiWrapper {
  target: TargetingApiWrapperTargetType
  range: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isTargetingApiWrapper(arg: any): arg is TargetingApiWrapper {
  return arg.target != null && arg.target.id != null
}

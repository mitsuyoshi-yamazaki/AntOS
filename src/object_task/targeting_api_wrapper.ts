export type TargetingApiWrapperTargetType = AnyCreep | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>

export interface TargetingApiWrapper {
  target: TargetingApiWrapperTargetType
}

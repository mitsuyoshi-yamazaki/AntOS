export type TargetingApiWrapperTargetType = AnyCreep | Resource | Tombstone | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>

export interface TargetingApiWrapper {
  target: TargetingApiWrapperTargetType
}

import { Position } from "shared/utility/position"

export type StructureObjectStateAbsence = {
  readonly case: "absence"
}
export type StructureObjectStateActive<S extends BuildableStructureConstant> = {
  readonly case: "active"
  readonly structure: Structure<S>
}
export type StructureObjectStateInactive<S extends BuildableStructureConstant> = {
  readonly case: "inactive"
  readonly structure: Structure<S>
}
export type StructureObjectStateConstructionSite<S extends BuildableStructureConstant> = {
  readonly case: "construction site"
  readonly constructionSite: ConstructionSite<S>
}
export type StructureObjectStateConstructingRampart = {  // 建設されたRampartはStructureObject.rampartIdから参照する
  readonly case: "constructing rampart"
  readonly constructionSite: ConstructionSite<STRUCTURE_RAMPART>
}
export type StructureObjectState<S extends BuildableStructureConstant> = StructureObjectStateAbsence
  | StructureObjectStateActive<S>
  | StructureObjectStateInactive<S>
  | StructureObjectStateConstructionSite<S>
  | StructureObjectStateConstructingRampart

export type StructureObject<S extends BuildableStructureConstant> = {
  position: Position
  state: StructureObjectState<S>
  rampartId: Id<StructureRampart> | null
}

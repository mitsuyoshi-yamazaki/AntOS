export const isStructureType = <T extends StructureConstant, S extends ConcreteStructure<T>> (structureType: T): (structure: AnyStructure) => structure is S => {
  return (structure: AnyStructure): structure is S => {
    return structure.structureType === structureType
  }
}

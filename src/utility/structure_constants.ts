import { Environment } from "./environment"

// const BuildableStructureConstant = [
//   STRUCTURE_EXTENSION,
//   STRUCTURE_RAMPART,
//   STRUCTURE_ROAD,
//   STRUCTURE_SPAWN,
//   STRUCTURE_LINK,
//   STRUCTURE_WALL,
//   STRUCTURE_STORAGE,
//   STRUCTURE_TOWER,
//   STRUCTURE_OBSERVER,
//   STRUCTURE_POWER_SPAWN,
//   STRUCTURE_EXTRACTOR,
//   STRUCTURE_LAB,
//   STRUCTURE_TERMINAL,
//   STRUCTURE_CONTAINER,
//   STRUCTURE_NUKER,
//   STRUCTURE_FACTORY,
// ]

const powerSpawnAvailableLevel = Environment.world === "season 3" ? 5 : 8

const StructureAvailability: { [structureType in BuildableStructureConstant]: number } = {
  extension: 1,
  rampart: 2,
  road: 0,
  spawn: 1,
  link: 5,
  constructedWall: 2,
  storage: 4,
  tower: 3,
  observer: 8,
  powerSpawn: powerSpawnAvailableLevel,
  extractor: 6,
  lab: 6,
  terminal: 6,
  container: 0,
  nuker: 8,
  factory: 7,
}

export const StructureGameConstants = {
  availability: StructureAvailability,
}

import { Driver } from "./driver"

export type GameDriver<T> = Driver<T>
export type IndependentGameDriver = GameDriver<void>
export type CreepGameDriver = GameDriver<Creep[]>
export type SpawnGameDriver = GameDriver<StructureSpawn[]>

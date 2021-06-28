import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { BuildTask, BuildTaskState } from "./creep_task/build_task"
import { HarvestEnergyTask, HarvestEnergyTaskState } from "./creep_task/harvest_energy_task"
import { TransferToStructureTask, TransferToStructureTaskState } from "./creep_task/transfer_to_structure_task"
import { UpgradeControllerTask, UpgradeControllerTaskState } from "./creep_task/upgrade_controller_task"
import { SpawnCreepTask, SpawnCreepTaskState } from "./spwan_task/spawn_creep_task"

export type TaskRunnerType = Creep | StructureSpawn | StructureTower
export type TargetType = Creep | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>

interface GameObjectTaskState extends State {
  /** start time */
  s: number

  /** type identifier */
  t: string
}

export interface GameObjectTaskReturnType<T> {  // TODO:
  value: T
  code: GameObjectTaskReturnCode
}
export type GameObjectTaskReturnCode = "finished" | "in progress" | "failed"

interface GameObjectTask<T> extends Stateful {
  targetId?: Id<TargetType>
  startTime: number
  taskType: string

  encode(): GameObjectTaskState
  run(obj: T): GameObjectTaskReturnCode
}

// ---- Creep Task ---- //
export interface CreepTaskState extends GameObjectTaskState {
  /** type identifier */
  t: keyof CreepTaskTypes
}

export interface CreepTask extends GameObjectTask<Creep> {
  taskType: keyof CreepTaskTypes
  shortDescription: string

  encode(): CreepTaskState
}

class CreepTaskTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestEnergyTask" = (state: CreepTaskState) => HarvestEnergyTask.decode(state as HarvestEnergyTaskState)
  "UpgradeControllerTask" = (state: CreepTaskState) => UpgradeControllerTask.decode(state as UpgradeControllerTaskState)
  "TransferToStructureTask" = (state: CreepTaskState) => TransferToStructureTask.decode(state as TransferToStructureTaskState)
  "BuildTask" = (state: CreepTaskState) => BuildTask.decode(state as BuildTaskState)
}

export function decodeCreepTask(creep: Creep): CreepTask | null {
  const state = creep.memory.ts
  if (state == null) {
    return null
  }
  let decoded: CreepTask | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new CreepTaskTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeCreepTask(), objective type: ${state.t}`)()
  return decoded
}

// ---- Spawn Task ---- //
export interface StructureSpawnTaskState extends GameObjectTaskState {
  /** type identifier */
  t: keyof SpawnTaskTypes
}

export interface StructureSpawnTask extends GameObjectTask<StructureSpawn> {
  taskType: keyof SpawnTaskTypes

  encode(): StructureSpawnTaskState
}

class SpawnTaskTypes {
  "SpawnCreepTask" = (state: StructureSpawnTaskState) => SpawnCreepTask.decode(state as SpawnCreepTaskState)
}

export function decodeSpawnTask(spawn: StructureSpawn): StructureSpawnTask | null {
  const state = spawn.memory.ts
  if (state == null) {
    return null
  }
  let decoded: StructureSpawnTask | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new SpawnTaskTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeSpawnTask(), objective type: ${state.t}`)()
  return decoded
}

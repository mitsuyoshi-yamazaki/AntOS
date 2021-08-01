import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { isV5CreepMemory } from "./creep"

type CreepRoleMover = "mover"
type CreepRoleHarvester = "harvester"
type CreepRoleWorker = "worker"
type CreepRoleEnergyStore = "energy_store"
type CreepRoleEnergySource = "energy_source"
type CreepRoleHauler = "hauler"
type CreepRoleScout = "scout"
type CreepRoleClaimer = "claimer"
type CreepRoleAttacker = "attacker"
type CreepRoleRangedAttacker = "ranged_attacker"
type CreepRoleHealer = "healer"

const creepRoleMover: CreepRoleMover = "mover"
const creepRoleHarvester: CreepRoleHarvester = "harvester"
const creepRoleWorker: CreepRoleWorker = "worker"
const creepRoleEnergyStore: CreepRoleEnergyStore = "energy_store"
const creepRoleEnergySource: CreepRoleEnergySource = "energy_source"
const creepRoleHauler: CreepRoleHauler = "hauler"
const creepRoleScout: CreepRoleScout = "scout"
const creepRoleClaimer: CreepRoleClaimer = "claimer"
const creepRoleAttacker: CreepRoleAttacker = "attacker"
const creepRoleRangedAttacker: CreepRoleRangedAttacker = "ranged_attacker"
const creepRoleHealer: CreepRoleHealer = "healer"

/** @deprecated */
export type CreepRole = CreepRoleMover
  | CreepRoleHarvester
  | CreepRoleWorker
  | CreepRoleEnergyStore
  | CreepRoleEnergySource
  | CreepRoleHauler
  | CreepRoleScout
  | CreepRoleClaimer
  | CreepRoleAttacker
  | CreepRoleRangedAttacker
  | CreepRoleHealer

/** @deprecated */
export const CreepRole = {
  Mover: creepRoleMover,

  /** @deprecated */
  Harvester: creepRoleHarvester,
  Worker: creepRoleWorker,
  EnergyStore: creepRoleEnergyStore,
  EnergySource: creepRoleEnergySource,
  Hauler: creepRoleHauler,
  Scout: creepRoleScout,
  Claimer: creepRoleClaimer,
  Attacker: creepRoleAttacker,
  RangedAttacker: creepRoleRangedAttacker,
  Healer: creepRoleHealer,
}

export function hasNecessaryRoles(creep: Creep, roles: CreepRole[]): boolean {
  if (!isV5CreepMemory(creep.memory)) {
    return false
  }
  const creepRoles = creep.memory.r
  const missingRoles = roles.some(role => creepRoles.includes(role) !== true)
  return missingRoles !== true
}

export function hasSomeRoles(creep: Creep, roles: CreepRole[]): boolean {
  if (!isV5CreepMemory(creep.memory)) {
    return false
  }
  const creepRoles = creep.memory.r
  return creepRoles.some(role => roles.includes(role) === true)
}

const workerRoles = [
  CreepRole.Mover,
  CreepRole.Harvester,
  CreepRole.Worker,
  CreepRole.EnergyStore,
  CreepRole.Hauler,
]
const mergeableRoles = new Map<CreepRole, CreepRole[]>([
  [CreepRole.Mover, workerRoles],
  [CreepRole.Harvester, [
    CreepRole.Mover,
    CreepRole.Harvester,
    CreepRole.EnergyStore,
  ]],
  [CreepRole.Worker, [
    CreepRole.Mover,
    CreepRole.Worker,
    CreepRole.EnergyStore,
  ]],
  [CreepRole.EnergyStore, workerRoles],
  [CreepRole.Hauler, [
    CreepRole.Mover,
    CreepRole.EnergyStore,
    CreepRole.Hauler,
  ]],
  [CreepRole.Scout, [CreepRole.Scout]],
  [CreepRole.Claimer, []],
])

export function mergeRoles(roles1: CreepRole[], roles2: CreepRole[]): CreepRole[] | null {
  const result = roles1.concat([])

  for (const role of roles1) {
    const mergeables = mergeableRoles.get(role)
    if (mergeables == null) {
      PrimitiveLogger.fatal(`Program bug: role ${role} not found in mergeableRoles`)
      continue
    }
    if (roles2.some(r => mergeables.includes(r) !== true)) {
      return null
    }
    result.push(...mergeables.filter(r => roles2.includes(r)))
  }

  return [...new Set(result)]
}

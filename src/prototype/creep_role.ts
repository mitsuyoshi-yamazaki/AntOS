import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { isV5CreepMemory } from "./creep"

type CreepRoleMover = "mover"
type CreepRoleHarvester = "harvester"
type CreepRoleWorker = "worker"
type CreepRoleEnergyStore = "energy_store"
type CreepRoleHauler = "hauler"
type CreepRoleScout = "scout"
type CreepRoleClaimer = "claimer"

const creepRoleMover: CreepRoleMover = "mover"
const creepRoleHarvester: CreepRoleHarvester = "harvester"
const creepRoleWorker: CreepRoleWorker = "worker"
const creepRoleEnergyStore: CreepRoleEnergyStore = "energy_store"
const creepRoleHauler: CreepRoleHauler = "hauler"
const creepRoleScout: CreepRoleScout = "scout"
const creepRoleClaimer: CreepRoleClaimer = "claimer"

export type CreepRole = CreepRoleMover | CreepRoleHarvester | CreepRoleWorker | CreepRoleEnergyStore | CreepRoleHauler | CreepRoleScout | CreepRoleClaimer
export const CreepRole = {
  Mover: creepRoleMover,
  Harvester: creepRoleHarvester,
  Worker: creepRoleWorker,
  EnergyStore: creepRoleEnergyStore,
  Hauler: creepRoleHauler,
  Scout: creepRoleScout,
  Claimer: creepRoleClaimer,
}

export function hasNecessaryRoles(creep: Creep, roles: CreepRole[]): boolean {
  if (!isV5CreepMemory(creep.memory)) {
    return false
  }
  const creepRoles = creep.memory.r
  const missingRoles = roles.some(role => creepRoles.includes(role) !== true)
  return missingRoles !== true
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

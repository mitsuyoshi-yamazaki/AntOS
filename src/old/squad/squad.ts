import { UID } from "../../utility"
import { CreepStatus, CreepType, ActionResult } from "old/creep"

export enum SpawnPriority {
  URGENT = 0,
  HIGH   = 1,
  NORMAL = 2,
  LOW    = 3,
  NONE   = 4, // no need to spawn creeps
}

export enum SquadType {
  WORKER            = "worker",
  UPGRADER          = "upgrader",
  CHARGER           = "charger",
  BOOSTED_UPGRADER  = "boosted_upgrader",
  HARVESTER         = "harvester",
  REMOET_HARVESTER  = "remote_harvester",
  REMOET_M_HARVESTER    = "remote_m_harvester",
  RESEARCHER        = "researcher",
  MANUAL            = "manual",
  SCOUT             = 'scout',
  ATTACKER          = 'attacker',
  INVADER           = 'invader',
  SWARM             = 'swarm',
  HARASSER          = 'harasser',
  TEMP              = "temp",
  NUKER_CHARGER_SQUAD = "nuker_charger",
  REMOTE_ATTACKER   = 'remote_attacker',
  FARMER = 'farmer',
  CREEP_PROVIDER_BRIDGING_SQUAD = 'creep_provider_bridging_squad',
}

export enum SquadStatus {
  NONE    = 'none',
  BUILD   = 'build',
  HARVEST = 'harvest',
  ESCAPE  = 'escape',
}

export interface SpawnFunction {
  (body: BodyPartConstant[], name: string, opts?: { memory?: CreepMemory, energyStructures?: Array<(StructureSpawn | StructureExtension)>, dryRun?: boolean }): ScreepsReturnCode
}

export interface SquadMemory {
  name: string
  type: SquadType
  owner_name: string  // Spawn name
  number_of_creeps: number
  stop_spawming?: boolean
  no_instantiation?: boolean  // @fixme:
}

export interface TargetSpecifier {
  target_room_names: string[]
  target_ids: {[room_name: string]: string[]}
}

export function getTargets(info: TargetSpecifier): {room_name: string | null, room: Room | null, structure: Structure | null} {
  const target: {room_name: string | null, room: Room | null, structure: Structure | null} = {
    room_name: info.target_room_names[0],
    room: null,
    structure: null,
  }

  if (target.room_name) {
    target.room = Game.rooms[target.room_name]

    if (target.room) {
      const target_ids = (info.target_ids || {})[target.room_name]
      if (target_ids) {
        for (const id of target_ids) {
          const structure = Game.getObjectById(id) as Structure | undefined

          if (structure && structure.room && (structure.room.name == target.room_name)) {
            target.structure = structure
            break
          }

          const index = target_ids.indexOf(id)
          if (index >= 0) {
            target_ids.splice(index, 1)
          }
        }
      }
    }
  }

  return target
}


/**
 * 1 WorkerSquad for each spawn
 */
export abstract class Squad {
  // Abstract members
  // public abstract readonly memory: SquadMemory // @todo: implement
  public abstract readonly type: SquadType
  public abstract readonly spawnPriority: SpawnPriority
  public abstract hasEnoughEnergy(energy_available: number, capacity: number): boolean
  public abstract addCreep(energy_available: number, spawn_func: SpawnFunction): void
  // public static abstract generateNewName(): string // this method should be implemented each subclasses
  public abstract generateNewName(): string
  public abstract run(): void

  // Non-abstract members
  public readonly creeps = new Map<string, Creep>()

  // public set memory(value: SquadMemory): void {

  // }
  // public get memory(): SquadMemory {

  // }

  // Methods
  constructor(readonly name: string, readonly base_room: Room) {
    const squad_creeps: Creep[] = Game.squad_creeps[this.name] || []

    squad_creeps.forEach((creep) => {
      creep.squad = this
      creep.initialize()
      this.creeps.set(creep.name, creep)
    })

    const squad_memory = Memory.squads[this.name] as SquadMemory | undefined

    if (squad_memory) {
      squad_memory.number_of_creeps = this.creeps.size
    }
  }

  public static need_instantiation(memory: SquadMemory, controller: StructureController): boolean {
    return true
  }

  public description(): string {
    const priority = Memory.squads[this.name].stop_spawming ? 'stop' : `${this.spawnPriority}`
    return `${this.name} ${this.creeps.size} crp, pri: ${priority}`
  }

  public showDescription(room: Room, index: number): void {
    if (!room) {
      return
    }
    if (!Memory.debug.show_visuals) {
      return
    }

    const room_memory = Memory.rooms[room.name]
    let pos: {x: number, y: number} = {x: 1, y: 3}

    if (room_memory && room_memory.description_position) {
      pos = room_memory.description_position
    }

    let lines: string[] = [
      this.description(),
    ]

    room.visual.multipleLinedText(lines, pos.x, (pos.y + index), {
      align: 'left',
      opacity: 0.8,
      font: '12px',
    })
  }

  public say(message: string): void {
    this.creeps.forEach((creep, _) => {
      creep.say(message)
    })
  }

  // --- Utility
  public addGeneralCreep(spawn_func: SpawnFunction, body: BodyPartConstant[], type: CreepType, opts?: {memory?: CreepMemory, let_thy_live?: boolean}): ScreepsReturnCode {
    opts = opts || {}

    const name = this.generateNewName()
    const memory: CreepMemory = opts.memory || {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type,
      should_notify_attack: false,
      let_thy_die: !opts.let_thy_live,
    }

    return spawn_func(body, name, {
      memory: memory
    })
  }

  public hasEnoughEnergyForUpgrader(energyAvailable: number, capacity: number, max_energy?: number): boolean {
    max_energy = max_energy || 2000

    capacity = Math.min(capacity, max_energy)
    capacity = Math.min(capacity, 4500)

    // const energy_unit = 500 // actual: 472.22
    const energy_unit = 300
    const energyNeeded = (Math.floor(capacity / energy_unit) * energy_unit)
    return energyAvailable >= energyNeeded
  }

  public addUpgrader(energyAvailable: number, spawnFunc: SpawnFunction, creep_type: CreepType, opts?: {max_energy?: number, memory?: CreepMemory}): void {
    opts = opts || {}

    const max_energy = opts.max_energy || 2000

    energyAvailable = Math.min(energyAvailable, max_energy)
    energyAvailable = Math.min(energyAvailable, 4500)

    const move: BodyPartConstant[] = [MOVE]
    // const work: BodyPartConstant[] = [WORK, WORK, WORK, WORK]
    const work: BodyPartConstant[] = [WORK, WORK]
    // const energy_unit = 500
    const energy_unit = 300

    let body: BodyPartConstant[] = []
    const name = this.generateNewName()
    const memory: CreepMemory = opts.memory || {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: creep_type,
      should_notify_attack: false,
      let_thy_die: true,
    }

    let number_of_units = 0

    while (energyAvailable >= energy_unit) {
      body = move.concat(body)
      body = body.concat(work)

      energyAvailable -= energy_unit
      number_of_units += 1
    }

    // const number_of_carries = Math.ceil((number_of_units * 4.0) / 9.0)
    const number_of_carries = Math.ceil((number_of_units * 2.0) / 9.0)

    for (let i = 0; i < number_of_carries; i++) {
      body.push(CARRY)
    }
    body.push(MOVE)

    const result = spawnFunc(body, name, {
      memory: memory
    })
  }

  public hasEnoughEnergyForRangedAttacker(energy_available: number, capacity: number): boolean {
    return energy_available >= 4000
  }

  public addBasicRangedAttacker(energy_available: number, spawn_func: SpawnFunction): void {
    // 4000

    const body: BodyPartConstant[] = [
      MOVE, MOVE, MOVE, MOVE,
      RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
      // RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
      // MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE,
      HEAL, HEAL, HEAL, HEAL, HEAL,
      HEAL,
    ]

    this.addGeneralCreep(spawn_func, body, CreepType.RANGED_ATTACKER)
  }

  public hasEnoughEnergyForGeneralAttacker(energy_available: number, capacity: number): boolean {
    return energy_available >= 3820
  }

  public addGeneralAttacker(energy_available: number, spawn_func: SpawnFunction): void {
    const body: BodyPartConstant[] = [
      TOUGH, TOUGH, TOUGH, TOUGH,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK,
      MOVE,
      HEAL, HEAL, HEAL, HEAL, HEAL,
    ]
    this.addGeneralCreep(spawn_func, body, CreepType.ATTACKER)
  }

  // ---
  public escapeFromHostileIfNeeded(creep: Creep, room_name: string, keeper_lairs?: StructureKeeperLair[]): ActionResult {

    const range = 6
    const ticks = range
    let flee_from: {x: number, y: number}
    const closest_hostile = creep.room.attacker_info().attacked ? creep.pos.findInRange(creep.room.attacker_info().hostile_creeps, range)[0] : undefined
    if (closest_hostile) {
      flee_from = closest_hostile.pos
    }
    else if ((creep.room.name == room_name) && keeper_lairs && (keeper_lairs.length > 0)) {
      const keeper_lair = creep.pos.findInRange(keeper_lairs, range, {
        filter: (lair: StructureKeeperLair) => {
          return (lair.ticksToSpawn || 0) < ticks
        }
      })[0]

      if (keeper_lair) {
        flee_from = keeper_lair.pos
      }
      else {
        return ActionResult.DONE
      }
    }
    else {
      return ActionResult.DONE
    }

    const goal: {pos: RoomPosition, range: number} = {
      pos: new RoomPosition(flee_from.x, flee_from.y, creep.room.name),
      range: 8,
    }
    const path: PathFinderPath = PathFinder.search(creep.pos, goal, {
      flee: true,
      maxRooms: 1,
    })

    if (path.path.length > 0) {
      creep.say(`FLEEp`)
      creep.moveByPath(path.path)
    }
    else {
      creep.say(`FLEE`)
      creep.moveTo(new RoomPosition(25, 25, creep.room.name), {maxRooms: 1, reusePath: 20})
    }

    return ActionResult.IN_PROGRESS
  }
}

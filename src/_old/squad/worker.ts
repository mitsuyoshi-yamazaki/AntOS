import { UID } from "../../utility"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType, WorkerSource } from "_old/creep"
import { isV4CreepMemory, V4CreepMemory } from "prototype/creep";

interface WorkerSquadMemory extends SquadMemory {
  number_of_workers?: number
  room_to_escape?: string
}

/**
 * WorkerSquad manages workers ([WORK, CARRY, MOVE] * n or [WORK * 2, CARRY * 2, MOVE * 3] * n)
 * to build or upgrade.
 */
export class WorkerSquad extends Squad {
  private number_of_workers: number
  private source_container: StructureContainer | undefined
  private additional_container_ids: string[] | undefined

  constructor(readonly name: string, readonly room: Room, readonly opt?: {source?: StructureContainer | undefined, additional_container_ids?: string[]}) {
    super(name, room)

    opt = opt || {}
    if (opt.source) {
      this.source_container = opt.source
    }
    this.additional_container_ids = opt.additional_container_ids

    const squad_memory = Memory.squads[this.name] as WorkerSquadMemory
    if (!squad_memory) {
      this.number_of_workers = 0
      return
    }

    const room_name = room.name

    if (squad_memory.number_of_workers) {
      this.number_of_workers = squad_memory.number_of_workers
    }
    else {
      this.number_of_workers = 8
    }
  }

  public get type(): SquadType {
    return SquadType.WORKER
  }

  public get spawnPriority(): SpawnPriority {
    const squad_memory = Memory.squads[this.name] as WorkerSquadMemory
    if (!squad_memory || squad_memory.stop_spawming) {
      return SpawnPriority.NONE
    }

    const size = this.creeps.size//this.room_name == 'W49S34' ? this.creeps.size : Array.from(this.creeps.values()).filter(c=>c.memory.type==CreepType.WORKER).length

    if (size < 2) {
      return SpawnPriority.URGENT
    }

    return size < this.number_of_workers ? SpawnPriority.NORMAL : SpawnPriority.NONE
  }

  public static generateNewName(): string {
    return UID(SquadType.WORKER)
  }

  public generateNewName(): string {
    return WorkerSquad.generateNewName()
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    if ((this.creeps.size < 1) && (energy_available >= 200)) {
      return true
    }
    // if (this.room_name == 'W56S7') {
    //   return true
    // }

    let energy_unit = 200

    const energy_needed = Math.min(Math.floor((capacity - 50) / energy_unit) * energy_unit, 1000)
    return energy_available >= energy_needed
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    let energy_unit = 200
    let body_unit: BodyPartConstant[] = [WORK, CARRY, MOVE]
    let type = CreepType.WORKER
    let let_thy_die = true

    const rcl = (!(!this.room.controller)) ? this.room.controller.level : 1
    let max = 1000

    if (rcl >= 6) {
      if (this.room.construction_sites && (this.room.construction_sites.length > 0)) {
        max = 2000
      }
      else {
        const number_of_carriers = Array.from(this.creeps.values()).filter(c => {
          if (!isV4CreepMemory(c.memory)) {
            return false
          }

          return c.memory.type == CreepType.CARRIER
        }).length

        if ((rcl >= 8) || ((rcl >= 6) && (this.creeps.size > 3) && (number_of_carriers < 2))) {
          body_unit = [CARRY, CARRY, MOVE]
          energy_unit = 150
          type = CreepType.CARRIER

          if (rcl == 8) {
            max = 1200
          }
        }
      }
    }


    let body: BodyPartConstant[] = []
    const name = this.generateNewName()
    const memory: V4CreepMemory = {


      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: type,
      should_notify_attack: false,
      let_thy_die: let_thy_die,
    }

    energy_available = Math.min(energy_available, max)

    while (energy_available >= energy_unit) {
      body = body.concat(body_unit)
      energy_available -= energy_unit
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  public run(): void {
    const storage = (this.room.storage && (this.room.storage.store.energy > 0)) ? this.room.storage : undefined
    const terminal = (this.room.terminal && (this.room.terminal.store.energy > 0)) ? this.room.terminal : undefined

    // If enemy storage | terminal is covered with a rampart, withdraw() throws error and workers stop moving
    const sources: WorkerSource[] = []
    if (storage) {
      sources.push(storage)
    }
    else if (terminal) {
      sources.push(terminal)
    }

    if (this.source_container) {
      sources.push(this.source_container)
    }

    let room_to_escape: string | undefined

    switch (this.room.name) {
      case 'W48S6':
        room_to_escape = 'W48S7'
        break
    }

    const squad_memory = Memory.squads[this.name] as WorkerSquadMemory
    if (squad_memory.room_to_escape) {
      room_to_escape = squad_memory.room_to_escape
    }

    for (const creep_name of Array.from(this.creeps.keys())) {
      const creep = this.creeps.get(creep_name)!
      if (!isV4CreepMemory(creep.memory)) {
        continue
      }

      if (creep.spawning) {
        continue
      }

      if (room_to_escape && ((this.room.attacker_info().attack + this.room.attacker_info().ranged_attack) > 0) && this.room.controller && this.room.controller.my && (this.room.controller.level <= 3)) {
        if (creep.memory.type == CreepType.WORKER) {
          creep.drop(RESOURCE_ENERGY)
        }
        if (creep.moveToRoom(room_to_escape) == ActionResult.IN_PROGRESS) {
          creep.say(`wRUN`)
          continue
        }
        creep.moveTo(new RoomPosition(25, 25, creep.room.name), {maxRooms: 1, reusePath: 20})
        continue
      }

      if (this.room.controller && this.room.controller.my && (this.room.controller.level < 4) && (creep.hits >= 1500)) {
        creep.memory.let_thy_die = false
      }
      else {
        creep.memory.let_thy_die = true
      }

      if (creep.room.name != this.room.name) {
        if ((creep.carry.energy > 0) && (creep.memory.type == CreepType.WORKER)) {
          creep.drop(RESOURCE_ENERGY)
        }
        creep.moveToRoom(this.room.name)
        continue
      }

      const needs_renew = !creep.memory.let_thy_die && ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) || (((creep.ticksToLive || 0) < 350) && (creep.carry.energy > (creep.carryCapacity * 0.8))))// !creep.memory.let_thy_die && ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) || ((creep.ticksToLive || 0) < 300))
      // if (creep.memory.status == CreepStatus.WAITING_FOR_RENEW) {
      //   creep.memory.status = CreepStatus.NONE
      // }

      if (needs_renew) {
        if ((creep.room.spawns.length > 0) && ((creep.room.energyAvailable > 40) || ((creep.ticksToLive ||0) > 400)) && !creep.room.spawns[0]?.spawning) {
          creep.goToRenew(creep.room.spawns[0]!)
          continue
        }
        else if (creep.memory.status == CreepStatus.WAITING_FOR_RENEW) {
          creep.memory.status = CreepStatus.HARVEST
        }
      }

      if (((creep.ticksToLive || 0) < 15) && creep.room.storage) {
        if (creep.transferResources(creep.room.storage) == ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.storage!)
        }
        continue
      }

      let opts: {additional_container_ids?: string[]} = {}

      if (this.additional_container_ids) {
        opts.additional_container_ids = this.additional_container_ids
      }

      creep.work(this.room, sources, opts)
    }
  }

  public description(): string {
    return `${super.description()}, ${this.creeps.size}/${this.number_of_workers}`
  }
}

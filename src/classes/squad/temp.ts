import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface TempMemory extends CreepMemory {
  arrived: boolean
}

interface TempSquadMemory extends SquadMemory {
  arrived: string
  should_spawn_claimer?: boolean
}

export class TempSquad extends Squad {
  private scout: Creep | undefined
  private claimer: Creep | undefined
  private attacker: Creep[] = []

  private spawn_attacker_ticks_before = 500
  private get arrived(): boolean {
    return (Memory.squads[this.name] as TempSquadMemory).arrived == this.target_room_name
  }

  constructor(readonly name: string, readonly base_room: Room, readonly target_room_name: string, readonly need_attacker: boolean, readonly layout: {name: string, pos: {x: number, y: number}} | undefined) {
    super(name, base_room)

    this.creeps.forEach((creep, _) => {
      switch (creep.memory.type) {
        case CreepType.SCOUT:
          this.scout = creep
          break

        case CreepType.CLAIMER:
          this.claimer = creep
          break

        case CreepType.ATTACKER:
          this.attacker.push(creep)
          break

        default:
          console.log(`TempSquad unexpected creep type ${creep.memory.type}, ${this.name}`)
          break
      }
    })
  }

  public get type(): SquadType {
    return SquadType.TEMP
  }

  public static generateNewName(): string {
    return UID('T')
  }

  public generateNewName(): string {
    return TempSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    const squad_memory = Memory.squads[this.name] as TempSquadMemory

    if (squad_memory) {
      if (squad_memory.should_spawn_claimer) {
        return SpawnPriority.URGENT
      }
      if (squad_memory.stop_spawming) {
        return SpawnPriority.NONE
      }
    }

    if (!this.target_room_name) {
      return SpawnPriority.NONE
    }

    if (!this.arrived) {
      if (!this.scout) {
        return SpawnPriority.LOW
      }
      else {
        return SpawnPriority.NONE
      }
    }

    const room = Game.rooms[this.target_room_name]

    if (room && room.controller && (room.controller.level < 5)) {
      if (this.need_attacker && (this.attacker.length < 1)) {
        return SpawnPriority.NORMAL
      }

      if ((this.attacker.length == 1) && ((this.attacker[0].ticksToLive || 1500) < this.spawn_attacker_ticks_before)) {
        return SpawnPriority.NORMAL
      }
    }

    if (this.attacker[0] && this.attacker[0].spawning) {
      return SpawnPriority.NONE
    }

    if (room && room.controller && room.controller.my) {
      return SpawnPriority.NONE
    }

    return !this.claimer ? SpawnPriority.NORMAL : SpawnPriority.NONE
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    const squad_memory = Memory.squads[this.name] as TempSquadMemory

    if (squad_memory) {
      if (squad_memory.should_spawn_claimer) {
        let energy = (capacity >= 850) ? 850 : 750
        return energy_available >= energy
      }
    }

    if (!this.arrived) {
      if (!this.scout) {
        return energy_available >= 50
      }
      else {
        return false
      }
    }

    const room = Game.rooms[this.target_room_name]

    if (room && room.controller && (room.controller.level < 5)) {
      if (this.need_attacker) {
        if ((this.attacker.length < 1)) {
          return this.hasEnoughEnergyForGeneralAttacker(energy_available, capacity)
        }

        if ((this.attacker.length == 1) && ((this.attacker[0].ticksToLive || 1500) < this.spawn_attacker_ticks_before)) {
          return this.hasEnoughEnergyForGeneralAttacker(energy_available, capacity)
        }
      }
    }

    if (room && room.controller && room.controller.my) {
      return false
    }

    let energy = (capacity >= 850) ? 850 : 750
    return energy_available >= energy
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    const squad_memory = Memory.squads[this.name] as TempSquadMemory

    if (squad_memory) {
      if (squad_memory.should_spawn_claimer) {
        this.addCreepForClaim(energy_available, spawn_func)
      }
    }

    if (!this.arrived) {
      if (!this.scout) {
        this.addGeneralCreep(spawn_func, [MOVE], CreepType.SCOUT)
      }
      return
    }

    const room = Game.rooms[this.target_room_name]

    if (room && room.controller && (room.controller.level < 5)) {
      if (this.need_attacker) {
        if ((this.attacker.length < 1)) {
          this.addGeneralAttacker(energy_available, spawn_func)
          return
          }

        if ((this.attacker.length == 1) && ((this.attacker[0].ticksToLive || 1500) < this.spawn_attacker_ticks_before)) {
          this.addGeneralAttacker(energy_available, spawn_func)
          return
        }
      }
    }

    if (room && room.controller && room.controller.my) {
      return
    }


    this.addCreepForClaim(energy_available, spawn_func)
  }

  private addCreepForClaim(energyAvailable: number, spawnFunc: SpawnFunction): void {
    let body: BodyPartConstant[] = (energyAvailable >= 850) ? [MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM] : [MOVE, MOVE, MOVE, CLAIM]
    const name = this.generateNewName()
    const memory: TempMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CLAIMER,
      should_notify_attack: false,
      let_thy_die: true,
      arrived: false,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    });

    (Memory.squads[this.name] as TempSquadMemory).should_spawn_claimer = undefined
  }

  public run(): void {
    this.runScout()
    this.runAttacker()
    this.runClaimer()
  }

  public description(): string {
    const addition = this.creeps.size > 0 ? `, ${Array.from(this.creeps.values())[0].pos}` : ''
    return `${super.description()} ${addition}`
  }

  // ---
  private runScout(): void {
    if (!this.scout) {
      return
    }
    const creep = this.scout

    if (creep.memory.stop) {
      return
    }

    if (creep.moveToRoom(this.target_room_name) == ActionResult.IN_PROGRESS) {
      return
    }
    if (!this.arrived) {
      (Memory.squads[this.name] as TempSquadMemory).arrived = this.target_room_name
    }

    if (creep.room.controller) {
      if (creep.pos.getRangeTo(creep.room.controller) < 5) {
        creep.memory.stop = true
      }
      else {
        creep.moveTo(creep.room.controller)
      }
    }
    else {
      creep.moveTo(new RoomPosition(25, 25, creep.room.name), {maxRooms: 1, reusePath: 20})
    }
  }

  private runAttacker(): void {
    this.attacker.forEach((creep) => {
      if (creep.searchAndDestroyTo(this.target_room_name, false) == ActionResult.IN_PROGRESS) {
        return
      }

      if (creep.room.spawns && creep.room.spawns[0]) {
        if ((creep.pos.getRangeTo(creep.room.spawns[0]) > 4)) {
          creep.moveTo(creep.room.spawns[0])
        }
      }
      else if (creep.room.controller) {
        if ((creep.pos.getRangeTo(creep.room.controller) > 5)) {
          creep.moveTo(creep.room.controller)
        }
      }
      else {
      }
    })
  }

  private runClaimer():void {
    if (!this.claimer) {
      return
    }
    const creep = this.claimer

    if (!this.target_room_name) {
      this.say(`ERR`)
      return
    }
    const target_room_name = this.target_room_name

    if (creep.moveToRoom(target_room_name) == ActionResult.IN_PROGRESS) {
      return
    }

    if (!this.arrived) {
      (Memory.squads[this.name] as TempSquadMemory).arrived = this.target_room_name
    }

    const memory = creep.memory as TempMemory
    if (!memory.arrived) {
      (creep.memory as TempMemory).arrived = true

      const message = `TempSquad.run arrived ${target_room_name} with ${creep.ticksToLive}, ${this.name}`
      console.log(message)
      Game.notify(message)
    }

    const target_room = Game.rooms[this.target_room_name]

    if (!creep.memory.stop && (creep.claim(target_room_name, true) == ActionResult.DONE)) {
      creep.memory.stop = true

      if (!Memory.rooms[target_room_name]) {
        Memory.rooms[target_room_name] = {
          harvesting_source_ids: [],
        }
      }

      // destroy others structures
      if (target_room && (target_room.name == creep.room.name)) {
        target_room.find(FIND_HOSTILE_CONSTRUCTION_SITES).forEach((construction_site) => {
          construction_site.remove()
        })

        target_room.find(FIND_HOSTILE_STRUCTURES, {
          filter: (structure) => {
            if (structure.my) {
              return false
            }
            const structures_to_destroy: StructureConstant[] = [
              STRUCTURE_EXTENSION,
              STRUCTURE_TOWER,
              STRUCTURE_SPAWN,
              STRUCTURE_OBSERVER,
              STRUCTURE_POWER_SPAWN,
              STRUCTURE_LINK,
            ]

            if (structures_to_destroy.indexOf(structure.structureType) >= 0) {
              return true
            }

            if (structure.structureType == STRUCTURE_LAB) {
              if (structure.mineralAmount == 0) {
                return true
              }
            }
            return false
          }
        }).forEach((structure) => {
          structure.destroy()
        })
      }

      // place flags
      if (this.layout) {
        const layout = target_room.place_layout(this.layout.name, {origin_pos: this.layout.pos})
      }
    }
    else if (target_room && target_room.memory) {
      target_room.memory.ancestor = this.base_room.name
    }

    if (((Game.time % 41) == 1) && (creep.room.name == target_room_name) && creep.room.controller) {
      if (creep.room.memory && creep.room.memory.is_gcl_farm) {
        creep.signController(creep.room.controller, `[${Game.version}] GCL Farm`)
      }
      else {
        if (!creep.room.controller.sign || (Memory.versions.indexOf(creep.room.controller.sign.text) < 0)) {
          creep.signController(creep.room.controller, Game.version)
        }
      }
    }
  }
}

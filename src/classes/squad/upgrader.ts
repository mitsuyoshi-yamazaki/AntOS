import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface UpgraderSquadMemory extends SquadMemory {
  // lab_ids?: string[]
  source_link_ids?: string[]
}

export class UpgraderSquad extends Squad {
  private max_energy: number | undefined

  public static need_instantiation(memory: SquadMemory, controller: StructureController): boolean {
    const squad_creeps = Game.squad_creeps[memory.name]
    if (squad_creeps && (squad_creeps.length > 0)) {
      return true
    }

    // no creeps
    if (memory.stop_spawming) {
      return false
    }

    return this.priority(controller, 0) != SpawnPriority.NONE
  }

  private static priority(controller: StructureController, creeps_size: number): SpawnPriority {
    const room = controller.room

    if (['dummy'].indexOf(room.name) >= 0) {
      return SpawnPriority.NONE
    }

    let max = 0

    if (!controller.my || !room.storage || !room.storage.my) {
      return SpawnPriority.NONE
    }

    const energy = room.storage.store.energy
    let available = (energy - 200000)

    if (available > 0) {
      max = Math.floor(available / 130000)
      max = Math.min(max, 2)
    }

    if (room.name == 'W51S29') {
      max = (room.storage.store.energy > 400000) ? 1 : 0
    }
    else if (['W48S12'].indexOf(room.name) >= 0) {
      max = Math.min(max, 1)
    }

    if (controller.level >= 8) {
      max = 1
    }

    return (creeps_size < max) ? SpawnPriority.LOW : SpawnPriority.NONE
  }

  constructor(readonly name: string, readonly controller: StructureController, readonly additional_source_ids: string[]) {
    super(name, controller.room)

    if (this.base_room.controller && this.base_room.controller.my) {
      if (this.base_room.controller.level == 8) {
        this.max_energy = 2000
      }
      else if (this.base_room.controller.level >= 7) {
        this.max_energy = 4500
      }
    }

    // if (this.room_name == 'W45S3') {
    //   this.max_energy = 4500
    // }
  }

  public get type(): SquadType {
    return SquadType.UPGRADER
  }

  public static generateNewName(): string {
    return UID(SquadType.UPGRADER)
  }

  public generateNewName(): string {
    return UpgraderSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    return UpgraderSquad.priority(this.controller, this.creeps.size)
  }

  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    if (this.max_energy) {
      return this.hasEnoughEnergyForUpgrader(energyAvailable, capacity, this.max_energy)
    }

    return this.hasEnoughEnergyForUpgrader(energyAvailable, capacity)
  }

  // --
  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    // capacity: 2300
    // 8 units, 2C, 16W, 9M

    const type = CreepType.WORKER

    if ((this.controller.level >= 8)) {
      // max 15 WORKs

      const body: BodyPartConstant[] = [
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        CARRY, MOVE,
      ]

      this.addGeneralCreep(spawnFunc, body, type)
      return
    }

    if (this.max_energy) {
      this.addUpgrader(energyAvailable, spawnFunc, type, {max_energy: this.max_energy})
      return
    }

    this.addUpgrader(energyAvailable, spawnFunc, type)
  }

  public run(): void {
    const squad_memory = Memory.squads[this.name] as UpgraderSquadMemory
    const source_ids = (squad_memory.source_link_ids || []).concat(this.additional_source_ids)
    const is_rcl8 = this.controller.my && (this.controller.level == 8)
    const room_name = this.controller.room.name

    let lab: StructureLab | undefined
    let no_lab = ['dummy'].indexOf(room_name) >= 0

    this.creeps.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      if (creep.room.name != room_name) {
        creep.drop(RESOURCE_ENERGY)
        creep.moveToRoom(room_name)
        return
      }

      const should_boost = !creep.boosted() && ((creep.ticksToLive || 0) > 1450) && !creep.memory.stop
      if (should_boost && this.controller.room.owned_structures && !is_rcl8) {
        const boost_compounds: ResourceConstant[] = [RESOURCE_GHODIUM_ACID, RESOURCE_CATALYZED_GHODIUM_ACID]

        if (!lab && !no_lab) {
          const labs = this.controller.room.owned_structures.get(STRUCTURE_LAB) as StructureLab[]

          if (labs) { // why?
            lab = labs.filter((l) => {
              if (!l || !l.mineralType) {
                return false
              }
              if (boost_compounds.indexOf(l.mineralType) < 0) {
                return false
              }
              return true
            }).sort(function(lhs, rhs){
              if( lhs!.mineralAmount > rhs!.mineralAmount ) return -1
              if( lhs!.mineralAmount < rhs!.mineralAmount ) return 1
              return 0
            })[0]

            if (!lab || (lab.mineralAmount < 90)) {
              no_lab = true
              lab = undefined
            }
          }
        }

        if (lab) {
          if (lab.pos.isNearTo(creep)) {
            lab.boostCreep(creep)
          }
          else {
            creep.moveTo(lab)
          }
          return
        }
      }

      creep.upgrade((structure) => {
        // If source is storage and it contains less energy, wait for charge
        if (structure.structureType == STRUCTURE_STORAGE) {
          return true
        }
        if (source_ids.indexOf(structure.id) >= 0) {
          const has_store = structure as {store?: StoreDefinition}
          if (has_store.store && (has_store.store.energy > 0)) {
            return true
          }

          const has_energy = structure as {energy?: number}

          if (has_energy.energy && (has_energy.energy > 0)) {
            return true
          }
        }
        return false
      })

      // if ((this.room_name == 'W45S3') && (this.creeps.size == 1) && (creep.memory.stop == true)) {
      //   const x = 18
      //   const y = 42

      //   if ((creep.pos.x != x) || (creep.pos.y != y)) {
      //     creep.moveTo(x, y)
      //   }
      // }
    })
  }
}

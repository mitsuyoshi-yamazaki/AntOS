import { UID } from "../../utility"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "_old/creep"
import { isV4CreepMemory } from "prototype/creep"

export interface RemoteMineralHarvesterSquadMemory extends SquadMemory {
  room_name: string
  mineral_id: string
  keeper_lair_id?: string
  number_of_carriers?: number
}

export class RemoteMineralHarvesterSquad extends Squad {
  private harvester: Creep | undefined
  private carriers: Creep[] = []
  private mineral: Mineral | undefined
  private keeper_lair: StructureKeeperLair | undefined
  readonly room_name: string

  constructor(readonly name: string, readonly base_room: Room, readonly destination: StructureStorage) {
    super(name, base_room)

    const squad_memory = Memory.squads[this.name] as RemoteMineralHarvesterSquadMemory

    this.mineral = Game.getObjectById(squad_memory.mineral_id) as Mineral | undefined
    const get_keeper_lair = () => {
      if (squad_memory.keeper_lair_id == null) {
        return undefined
      }
      return Game.getObjectById(squad_memory.keeper_lair_id) as StructureKeeperLair | undefined
    }
    this.keeper_lair = get_keeper_lair()
    this.room_name = squad_memory.room_name

    if (!this.room_name) {
      console.log(`RemoteMineralHarvesterSquad.room_name is not provided ${this.room_name}, ${this.name}`)
    }

    this.creeps.forEach((creep) => {
      if (!isV4CreepMemory(creep.memory)) {
        return
      }
      switch (creep.memory.type) {
        case CreepType.HARVESTER:
          this.harvester = creep
          break

        case CreepType.CARRIER:
          this.carriers.push(creep)
          break

        default:
          console.log(`RemoteMineralHarvesterSquad unexpected creep type ${creep.memory.type}, ${this.name}`)
          break
      }
    })

    const room = Game.rooms[this.room_name]
    if (room) {
      let index = 1
      if (this.name == 'remote_m_harvester04') {
        index = 2
      }
      this.showDescription(room, index)
    }
  }

  public get type(): SquadType {
    return SquadType.REMOET_M_HARVESTER
  }

  public static generateNewName(): string {
    return UID(SquadType.REMOET_M_HARVESTER)
  }

  public generateNewName(): string {
    return RemoteMineralHarvesterSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    const memory = (Memory.squads[this.name] as RemoteMineralHarvesterSquadMemory)
    if (memory.stop_spawming) {
      return SpawnPriority.NONE
    }

    if (!this.destination) {
      const message = `RemoteMineralHarvesterSquad.spawnPriority no destination ${this.destination}, ${this.name}, ${this.room_name}`
      console.log(message)
      Game.notify(message)
      return SpawnPriority.NONE
    }

    if (!this.mineral) {
      return SpawnPriority.NONE
    }
    if (this.mineral.mineralAmount == 0) {
      return SpawnPriority.NONE
    }

    if (this.mineral.room && this.mineral.room.controller && (!this.mineral.room.controller.my || (this.mineral.room.controller.my && (this.mineral.room.controller.level < 6)))) {
      return SpawnPriority.NONE
    }

    if (!this.harvester) {
      return SpawnPriority.LOW
    }

    const number_of_carriers = memory.number_of_carriers || 1

    if (this.carriers.length < number_of_carriers) {
      return SpawnPriority.NORMAL
    }

    return SpawnPriority.NONE
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    if (!this.harvester) {
      return energy_available >= 3000
    }
    if (this.room_name == 'W45S5') {
      return energy_available >= 1500
    }
    return energy_available >= 1000
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    if (!this.harvester) {
      this.addHarvester(energy_available, spawn_func)
      return
    }

    this.addCarrier(energy_available, spawn_func)
    return
  }

  public run(): void {
    this.runHarvester()
    this.runCarrier()
  }

  // ---
  private addHarvester(energy_available: number, spawn_func: SpawnFunction): void {
    // 20W, 10M, 10C

    const body: BodyPartConstant[] = [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]

    this.addGeneralCreep(spawn_func, body, CreepType.HARVESTER)
  }

  private addCarrier(energy_available: number, spawn_func: SpawnFunction): void {
    let body: BodyPartConstant[] = [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]

    if (this.room_name == 'W45S5') {
      body = [
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        CARRY, CARRY, CARRY, CARRY, CARRY,
        CARRY, CARRY, CARRY, CARRY, CARRY,
        CARRY, CARRY, CARRY, CARRY, CARRY,
        MOVE, MOVE, MOVE, MOVE, MOVE,
      ]
    }

    this.addGeneralCreep(spawn_func, body, CreepType.CARRIER)
  }

  private runHarvester() {
    if (!this.harvester) {
      return
    }

    const creep = this.harvester
    if (creep.spawning) {
      return
    }

    const keeper_lairs = this.keeper_lair ? [this.keeper_lair] : []

    if (creep.room.name == this.room_name) {
      if (this.escapeFromHostileIfNeeded(creep, this.room_name, keeper_lairs) == ActionResult.IN_PROGRESS) {
        return
      }
    }

    if (this.mineral) {
      if (creep.pos.isNearTo(this.mineral)) {
        creep.harvest(this.mineral)
      }
      else {
        if ((this.room_name == 'W46S26') && (creep.room.name == 'W45S27')) {
          creep.moveToRoom('W45S26')
          return
        }

        creep.moveTo(this.mineral)
      }
    }
    else {
      if (creep.moveToRoom(this.room_name) == ActionResult.IN_PROGRESS) {
        return
      }
    }
  }

  private runCarrier() {
    const keeper_lairs = this.keeper_lair ? [this.keeper_lair] : []

    this.carriers.forEach((creep) => {
      if (!isV4CreepMemory(creep.memory)) {
        return
      }
      if (creep.spawning) {
        return
      }

      const carry = creep.store.getUsedCapacity()

      if (creep.room.name == this.room_name) {
        if (this.escapeFromHostileIfNeeded(creep, this.room_name, keeper_lairs) == ActionResult.IN_PROGRESS) {
          if (carry > 0) {
            creep.memory.status = CreepStatus.CHARGE
          }
          return
        }
      }

      const no_resource = (this.mineral && (this.mineral.mineralAmount == 0) && (carry > 0))

      if ((carry > (creep.carryCapacity - 30)) || no_resource) {
        if (creep.transferResources(this.destination) == ERR_NOT_IN_RANGE) {
          creep.memory.status = CreepStatus.CHARGE
          if (['W46S26', 'W45S26'].indexOf(creep.room.name) >= 0) {
            creep.moveToRoom(this.destination.room.name)
            return
          }
          creep.moveTo(this.destination)
        }
        return
      }

      if (this.harvester && !this.harvester.spawning) {
        if ((this.room_name == 'W46S26') && (creep.room.name != this.harvester.room.name)) {
          creep.moveToRoom(this.harvester.room.name)
          return
        }

        if (this.mineral) {
          if (this.harvester.pos.isNearTo(creep)) {
            this.harvester.transfer(creep, this.mineral.mineralType)
          }
          else {
            creep.moveTo(this.harvester)
          }

          // const contains_energy = (carry > 0)

          const drop = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
            filter: (d: Resource) => {
              // if (contains_energy) {
              //   return true
              // }
              return d.resourceType != RESOURCE_ENERGY
            }
          })[0]

          if (drop) {
            creep.pickup(drop)
          }
          // else {
          //   const tombstone = creep.pos.findInRange(FIND_TOMBSTONES, 1, {
          //     filter: (tomb: Tombstone) => {
          //       return (_.sum(tomb.store) - tomb.store.energy) > 0
          //     }
          //   })[0]

          //   if (tombstone) {
          //     creep.withdrawResources(tombstone)
          //   }
          // }
        }
        else {
          creep.moveTo(this.harvester)
        }
        return
      }

      creep.moveToRoom(this.room_name)
    })
  }

  // ---
  public description(): string {
    const number_of_creeps = `H${!(!this.harvester) ? 1 : 0}C${this.carriers.length}`
    return `${super.description()}, ${this.room_name}, ${number_of_creeps}`
  }
}

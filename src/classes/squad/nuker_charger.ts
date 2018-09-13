import { UID, room_link } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

export interface NukerChargerSquadMemory extends SquadMemory {
  nuker_id: string | undefined
}

export class NukerChargerSquad extends Squad {
  private nuker: StructureNuker | undefined

  private reason: string = ''

  constructor(readonly name: string, readonly room: Room) {
    super(name)

    const squad_memory = Memory.squads[this.name] as NukerChargerSquadMemory

    if (squad_memory && squad_memory.nuker_id) {
      this.nuker = Game.getObjectById(squad_memory.nuker_id) as StructureNuker | undefined
    }
    else if ((Game.time % 29) == 5) {
      console.log(`NukerChargerSquad undefined nuker id ${this.name}, ${room_link(this.room.name)}`)
    }
  }

  public get type(): SquadType {
    return SquadType.NUKER_CHARGER_SQUAD
  }

  public static generateNewName(): string {
    return UID(SquadType.NUKER_CHARGER_SQUAD)
  }

  public generateNewName(): string {
    return NukerChargerSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    if (!this.room.terminal || !this.room.storage || !this.nuker) {
      this.reason = `missing structures`
      return SpawnPriority.NONE
    }

    if (this.room.storage.store.energy < 400000) {
      this.reason = `lack of energy`
      return SpawnPriority.NONE
    }

    if ((this.nuker.ghodium == this.nuker.ghodiumCapacity) && (this.nuker.energy == this.nuker.energyCapacity)) {
      this.reason = `finished`
      return SpawnPriority.NONE
    }

    const ghodium_needs = this.nuker.ghodiumCapacity - this.nuker.ghodium
    if (ghodium_needs > 0) {
      const ghodium = (this.room.terminal.store[RESOURCE_GHODIUM] || 0) + (this.room.storage.store[RESOURCE_GHODIUM] || 0)

      if (ghodium_needs > ghodium) {
        this.reason = `lack of Ghodium`
        return SpawnPriority.NONE
      }
    }

    return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    return energy_available >= 1500
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    const body: BodyPartConstant[] = [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]
    this.addGeneralCreep(spawn_func, body, CreepType.CARRIER)
  }

  public run(): void {
    if (!this.room.terminal || !this.room.storage || !this.nuker) {
      if ((Game.time % 43) == 3) {
        console.log(`NukerChargerSquad.run ${this.room.name} no storage, terminal nor nuker`)
      }
      return
    }

    const terminal = this.room.terminal
    const storage = this.room.storage
    const nuker = this.nuker

    const opt: MoveToOpts = {
      maxOps: 200,
      maxRooms: 1,
      reusePath: 3,
    }

    this.creeps.forEach((creep) => {
      const carry = _.sum(creep.carry)

      if (carry > 0) {
        if (creep.carry.energy > 0) {
          if (creep.transfer(nuker, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(nuker, opt)
          }
          else {
            creep.moveTo(storage, opt)
          }
        }
        else {
          if (creep.transfer(nuker, RESOURCE_GHODIUM) == ERR_NOT_IN_RANGE) {
            creep.moveTo(nuker, opt)
          }
          else {
            creep.moveTo(storage, opt)
          }
        }
      }
      else {
        if (nuker.ghodium == nuker.ghodiumCapacity) {
          if (creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            creep.moveTo(storage, opt)
          }
          else {
            creep.moveTo(nuker, opt)
          }
        }
        else {
          if (creep.withdraw(terminal, RESOURCE_GHODIUM) == ERR_NOT_IN_RANGE) {
            creep.moveTo(terminal, opt)
          }
          else {
            creep.moveTo(nuker, opt)
          }
        }
      }
    })
  }

  public description(): string {
    return `${super.description()}, ${this.reason}`
  }
}

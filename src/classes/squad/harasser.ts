import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface HarasserSquadMemory extends SquadMemory {
  target_rooms: string[]
  target_ids: {[room_name: string]: string[]}
  max_creeps?: number
  no_spawn: boolean     // instantiate InvaderSquad but no spawn
}

export class HarasserSquad extends Squad {
  private next_creep: CreepType | null

  constructor(readonly name: string, readonly base_room: Room) {
    super(name)

    this.next_creep = this.setNextCreep()
  }

  private setNextCreep(): CreepType | null {
    const squad_memory = Memory.squads[this.name] as HarasserSquadMemory
    if (!squad_memory) {  // @fixme: no_spawn
      return null
    }

    const max = squad_memory.max_creeps || 1

    if (this.creeps.size >= max) {
      return null
    }

    const is_spawning = Array.from(this.creeps.values()).filter(creep => {
      return creep.spawning
    }).length > 0

    if (is_spawning) {
      return null
    }

    return CreepType.RANGED_ATTACKER
  }

  public get type(): SquadType {
    return SquadType.HARASSER
  }

  public static generateNewName(): string {
    return UID('H')
  }

  public generateNewName(): string {
    return HarasserSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    if (!this.next_creep) {
      return SpawnPriority.NONE
    }
    return SpawnPriority.LOW
  }

  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    return this.hasEnoughEnergyForRangedAttacker(energyAvailable, capacity)
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    this.addBasicRangedAttacker(energyAvailable, spawnFunc)
  }

  public run(): void {
    const squad_memory = Memory.squads[this.name] as HarasserSquadMemory
    const target_room = (squad_memory && squad_memory.target_rooms && squad_memory.target_rooms[0]) ? squad_memory.target_rooms[0] : this.base_room.name

    this.creeps.forEach(creep => {
      if (creep.spawning) {
        return
      }

      creep.searchAndDestroyTo(target_room, true)
    })
  }
}

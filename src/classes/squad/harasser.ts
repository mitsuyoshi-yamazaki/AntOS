import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface HarasserSquadMemory extends SquadMemory {
  target_rooms: string[]
  no_spawn: boolean     // instantiate InvaderSquad but no spawn
}

export class HarasserSquad extends Squad {
  private next_creep: CreepType | null

  constructor(readonly name: string, readonly base_room: Room) {
    super(name)

    this.next_creep = this.setNextCreep()
  }

  private setNextCreep(): CreepType | null {
    const squad_memory = Memory.squads[this.name]
    if (!squad_memory) {
      return null
    }

    const max = 2 // @fixme:

    if (this.creeps.size >= 2) {
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
    return SpawnPriority.NONE
  }

  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    return this.hasEnoughEnergyForRangedAttacker(energyAvailable, capacity)
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    this.addBasicRangedAttacker(energyAvailable, spawnFunc)
  }

  public run(): void {
  }
}

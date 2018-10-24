import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

export class HarasserSquad extends Squad {
  constructor(readonly name: string, readonly base_room: Room) {
    super(name)
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
    return false
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
  }

  public run(): void {
  }
}

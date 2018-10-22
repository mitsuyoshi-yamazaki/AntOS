import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface SwarmSquadMemory extends SquadMemory {
  target_room_names: string[]
  target_ids: {[room_name: string]: string[]}
  max_creeps: number
  messages: string[]
}

export class SwarmSquad extends Squad {


  constructor(readonly name: string, readonly base_room: Room) {
    super(name)

    this.creeps.forEach((creep) => {
      switch (creep.memory.type) {
        case CreepType.ATTACKER:
          break

        case CreepType.HEALER:
          break

        default:
          console.log(`SwarmSquad unexpected creep type ${creep.memory.type}, ${this.name}, ${creep.pos}`)
          break
      }
    })
  }

  public get type(): SquadType {
    return SquadType.SWARM
  }

  public static generateNewName(): string {
    return UID('S')
  }

  public generateNewName(): string {
    return SwarmSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    return SpawnPriority.NONE // @todo:
  }

  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    return false // @todo:
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
     // @todo:
  }

  public run(): void {
    // @todo:
  }

  public description(): string {
    return `${super.description()}` // @todo:
  }
}

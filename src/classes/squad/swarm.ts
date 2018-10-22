import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface SwarmSquadMemory extends SquadMemory {
  target_room_names: string[]
  target_ids: {[room_name: string]: string[]}
  max_creeps: number
  no_spawn: boolean
  stop_by: number     // Flag no_spawn when spawned reaches stop_by
  spawned: number     // Increase by addCreep(). Reset by no_spawn
  debug: boolean
  messages: string[]
}

export class SwarmSquad extends Squad {
  private next_creep: CreepType | null
  private attackers: Creep[] = []
  private healers: Creep[] = []

  constructor(readonly name: string, readonly base_room: Room) {
    super(name)

    this.creeps.forEach((creep) => {
      switch (creep.memory.type) {
        case CreepType.ATTACKER:
          this.attackers.push(creep)
          break

        case CreepType.HEALER:
          this.healers.push(creep)
          break

        default:
          console.log(`SwarmSquad unexpected creep type ${creep.memory.type}, ${this.name}, ${creep.pos}`)
          break
      }
    })

    this.next_creep = this.setNextCreep()
  }

  private setNextCreep(): CreepType | null {
    const squad_memory = Memory.squads[this.name] as SwarmSquadMemory
    if (!squad_memory) {
      return null
    }
    if (squad_memory.no_spawn) {
      squad_memory.spawned = 0
      return null
    }
    if (squad_memory.stop_by <= squad_memory.spawned) {
      squad_memory.no_spawn = true

      const message = `SwarmSquad reached maximum creep size: stopped spawning ${this.name}, ${this.base_room.name}`
      console.log(message)
      Game.notify(message)

      return null
    }

    if (this.healers.length < 2) {
      return CreepType.HEALER
    }

    if (this.creeps.size >= squad_memory.max_creeps) {
      return null
    }

    if (this.healers.length < this.attackers.length) {
      return CreepType.HEALER
    }
    return CreepType.ATTACKER
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
    if (!this.next_creep) {
      return SpawnPriority.NONE
    }
    return SpawnPriority.LOW
  }

  public hasEnoughEnergy(energyAvailable: number, capacity: number): boolean {
    return false // @todo:
  }

  public addCreep(energyAvailable: number, spawnFunc: SpawnFunction): void {
    const squad_memory = Memory.squads[this.name] as SwarmSquadMemory
    if (!squad_memory) {
      return
    }

    squad_memory.spawned += 1

    switch (this.next_creep) {
      case CreepType.ATTACKER:
        this.addAttacker(energyAvailable, spawnFunc, squad_memory)
        break

      case CreepType.HEALER:
        this.addHealer(energyAvailable, spawnFunc, squad_memory)
        break

      default:
        break
    }
  }

  private addAttacker(energyAvailable: number, spawnFunc: SpawnFunction, squad_memory: SwarmSquadMemory): void {
    let body: BodyPartConstant[]

    if (squad_memory.debug) {
      body = [
        ATTACK, ATTACK,
        MOVE, MOVE,
      ]
    }
    else {
      body = [
        ATTACK, ATTACK,
        MOVE, MOVE,
      ]
    }

    this.addGeneralCreep(spawnFunc, body, CreepType.ATTACKER)
  }

  private addHealer(energyAvailable: number, spawnFunc: SpawnFunction, squad_memory: SwarmSquadMemory): void {
    let body: BodyPartConstant[]

    if (squad_memory.debug) {
      body = [
        MOVE, MOVE,
        HEAL, HEAL,
      ]
    }
    else {
      body = [
        MOVE, MOVE,
        HEAL, HEAL,
      ]
    }

    this.addGeneralCreep(spawnFunc, body, CreepType.ATTACKER)
  }

  public run(): void {
    // @todo:
  }

  public description(): string {
    return `${super.description()}` // @todo:
  }
}

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
  private current_target_room_name: string | undefined

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

    const squad_memory = Memory.squads[this.name] as SwarmSquadMemory
    if (squad_memory) {
      this.current_target_room_name = squad_memory.target_room_names[0]
    }

    this.next_creep = this.setNextCreep()
  }

  private setNextCreep(): CreepType | null {
    const show_reason = false

    if (!this.current_target_room_name) {
      if (show_reason) {
        console.log(`SwarmSquad.setNextCreep no target room ${this.name}`)
      }
      return null
    }

    const squad_memory = Memory.squads[this.name] as SwarmSquadMemory
    if (!squad_memory) {
      if (show_reason) {
        console.log(`SwarmSquad.setNextCreep no squad memory ${this.name}, ${squad_memory}`)
      }
      return null
    }
    if (squad_memory.no_spawn) {
      squad_memory.spawned = 0
      if (show_reason) {
        console.log(`SwarmSquad.setNextCreep no_spawn room ${this.name}`)
      }
      return null
    }
    if (squad_memory.stop_by <= squad_memory.spawned) {
      squad_memory.no_spawn = true

      const message = `SwarmSquad reached maximum creep size: stopped spawning ${this.name}, ${this.base_room.name}`
      console.log(message)
      Game.notify(message)

      if (show_reason) {
        console.log(`SwarmSquad.setNextCreep stop_by reached ${this.name}`)
      }
      return null
    }

    if (this.healers.length < 2) {
      if (show_reason) {
        console.log(`SwarmSquad.setNextCreep minimum healer ${this.name}`)
      }
      return CreepType.HEALER
    }

    if (this.creeps.size >= squad_memory.max_creeps) {
      if (show_reason) {
        console.log(`SwarmSquad.setNextCreep max_creeps reached ${this.name}`)
      }
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
        ATTACK, MOVE,
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
        MOVE, HEAL,
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
    if (!this.current_target_room_name) {
      this.say(`NO TGT`)
      return
    }
    const current_target = this.current_target_room_name

    this.creeps.forEach((creep) => {
      if (creep.moveToRoom(current_target) == ActionResult.IN_PROGRESS) {
        return  // @todo: attack
      }


    })
  }

  public description(): string {
    return `${super.description()}, ${this.current_target_room_name}, ${this.next_creep}, A${this.attackers.length}H${this.healers.length}`
  }
}

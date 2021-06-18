import { UID } from "../../linted/utility"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "old/creep"

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

const waypoint = new RoomPosition(5, 35, 'W55S8') // @fixme:

export class SwarmSquad extends Squad {
  private current_target_room_name: string | undefined
  private current_target_room: Room | undefined
  private current_target: Structure | undefined

  private next_creep: CreepType | null
  private attackers: Creep[] = []
  private healers: Creep[] = []

  constructor(readonly name: string, readonly base_room: Room) {
    super(name, base_room)

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

      if (this.current_target_room_name) {
        this.current_target_room = Game.rooms[this.current_target_room_name]

        if (this.current_target_room) {
          const target_ids = (squad_memory.target_ids || {})[this.current_target_room_name]
          if (target_ids) {
            for (const id of target_ids) {
              const target = Game.getObjectById(id) as Structure | undefined

              if (target) {
                this.current_target = target
                break
              }

              const index = target_ids.indexOf(id)
              if (index >= 0) {
                target_ids.splice(index, 1)
              }
            }
          }
        }
      }
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

    if (this.healers.length <= this.attackers.length) {
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
    const squad_memory = Memory.squads[this.name] as SwarmSquadMemory

    if (squad_memory && squad_memory.debug) {

      switch (this.next_creep) {
        case CreepType.ATTACKER:
          return energyAvailable >= 160

        case CreepType.HEALER:
          return energyAvailable >= 600

        default:
          return false
      }
    }
    else {
      switch (this.next_creep) {
        case CreepType.ATTACKER:
          return energyAvailable >= 1600

        case CreepType.HEALER:
          return energyAvailable >= 4800

        default:
          return false
      }
    }
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
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
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
        TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
        HEAL, HEAL, HEAL, HEAL, HEAL,
        HEAL, HEAL, HEAL, HEAL, HEAL,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        HEAL, HEAL, HEAL, HEAL, HEAL,
      ]
    }

    this.addGeneralCreep(spawnFunc, body, CreepType.HEALER)
  }

  public run(): void {
    if (!this.current_target_room_name) {
      this.say(`NO TGT`)
      return
    }
    const target_room_name = this.current_target_room_name

    this.creeps.forEach((creep) => {
      const should_escape = creep.hits < (creep.hitsMax * 0.7)

      if (should_escape || ((creep.room.name == waypoint.roomName) && (creep.hits < creep.hitsMax))) {
        this.escape(creep)
        return
      }

      if (creep.room.name != this.current_target_room_name) {
        switch (creep.memory.type) {
          case CreepType.ATTACKER:
            const target = creep.pos.findClosestByPath(creep.room.attacker_info().hostile_creeps)
            if (target) {
              creep.destroy(target)
              return
            }
            break

          case CreepType.HEALER: {
            const heal_target = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
              filter: (c) => {
                return c.hits < c.hitsMax
              }
            })
            if (heal_target) {
              creep.moveTo(heal_target)
              creep.healNearbyCreep()
              return
            }
            break
          }

          default:
            break
        }
      }

      if (creep.moveToRoom(target_room_name) == ActionResult.IN_PROGRESS) {
        return  // @todo: attack
      }

      switch (creep.memory.type) {
        case CreepType.ATTACKER:
          if (this.current_target) {
            creep.destroy(this.current_target)
          }
          else {
            creep.searchAndDestroy()
          }
          break

        case CreepType.HEALER: {
          creep.healNearbyCreep()

          const heal_target = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
            filter: (c) => {
              return c.hits < c.hitsMax
            }
          })
          if (heal_target) {
            creep.moveTo(heal_target)
          }
          break
        }

        default:
          break
      }
    })
  }

  private escape(creep: Creep): void {
    creep.moveTo(waypoint)
    creep.healNearbyCreep()
  }

  public description(): string {
    return `${super.description()}, ${this.current_target_room_name}, ${this.next_creep}, A${this.attackers.length}H${this.healers.length}`
  }
}

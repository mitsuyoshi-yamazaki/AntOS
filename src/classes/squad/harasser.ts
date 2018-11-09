import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface HarasserSquadMemory extends SquadMemory {
  target_rooms: string[]
  target_room_index: number
  target_ids: {[room_name: string]: string[]}
  max_creeps?: number
  no_spawn: boolean     // instantiate InvaderSquad but no spawn
}

export class HarasserSquad extends Squad {
  private next_creep: CreepType | null
  private target_room_name: string
  private target_room: Room | undefined

  constructor(readonly name: string, readonly base_room: Room) {
    super(name)

    const squad_memory = Memory.squads[this.name] as HarasserSquadMemory

    if (squad_memory && squad_memory.target_rooms && squad_memory.target_rooms.length) {
      const specified_target_room_name = squad_memory.target_rooms[squad_memory.target_room_index]
      const patrolling_room_names: string[] = Array.from(this.creeps.values()).map(creep=>creep.room.name)

      if (specified_target_room_name) {
        const is_in_room = (patrolling_room_names.indexOf(specified_target_room_name) >= 0)

        if (is_in_room) {
          const specified_target_room = Game.rooms[specified_target_room_name]

          if (specified_target_room) {
            if (specified_target_room.attacker_info().hostile_creeps.length) {
              this.target_room = specified_target_room
              this.target_room_name = specified_target_room_name
            }
            else {
              if (squad_memory.target_rooms.length) {
                squad_memory.target_room_index = (squad_memory.target_room_index + 1) % squad_memory.target_rooms.length
              }
              else {
                squad_memory.target_room_index = 0
              }

              this.target_room_name = this.base_room.name
              this.target_room = this.base_room
            }
          }
          else {
            const message = `HarasserSquad something wrong ${this.name}`
            console.log(message)
            Game.notify(message)

            this.target_room_name = this.base_room.name
            this.target_room = this.base_room
          }
        }
        else {
          this.target_room = Game.rooms[specified_target_room_name]
          this.target_room_name = specified_target_room_name
        }
      }
      else {
        squad_memory.target_room_index = 0
        this.target_room_name = this.base_room.name
        this.target_room = this.base_room
        }
    }
    else {
      this.target_room_name = this.base_room.name
      this.target_room = this.base_room
    }

    this.next_creep = this.setNextCreep()
  }

  private setNextCreep(): CreepType | null {
    const squad_memory = Memory.squads[this.name] as HarasserSquadMemory
    if (!squad_memory || !squad_memory.target_rooms || (squad_memory.target_rooms.length == 0)) {  // @fixme: no_spawn
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
    this.creeps.forEach(creep => {
      if (creep.spawning) {
        return
      }

      creep.searchAndDestroyTo(this.target_room_name, true)
    })
  }
}

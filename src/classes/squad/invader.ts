import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface InvaderMemory extends CreepMemory {
  pair_id: number
}

interface InvaderSquadMemory extends SquadMemory {
  target_room_names: string[]
  target_ids: {[room_name: string]: string[]}
  only_once: boolean
  no_spawn: boolean
}

export class InvaderSquad extends Squad {
  private target_room_name: string | undefined
  private target: Structure | undefined

  private leader: Creep | undefined
  private follower: Creep | undefined

  private next_creep: CreepType | undefined

  constructor(readonly name: string, readonly base_room: Room) {
    super(name)

    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    if (squad_memory) {
      const target_room_names = squad_memory.target_room_names || []
      this.target_room_name = target_room_names[0]

      const target_room = Game.rooms[this.target_room_name] as Room | undefined
      if (target_room) {
        const target_ids = (squad_memory.target_ids || {})[this.target_room_name]
        if (target_ids) {
          for (const id of target_ids.reverse()) {
            const target = Game.getObjectById(id) as Structure | undefined

            if (target) {
              this.target = target
              break
            }

              const index = target_ids.indexOf(id)
              if (index >= 0) {
                target_ids.splice(index, 1)
              }
          }
        }
      }


      // for (const room_name in target_ids) {
      //   if

      //   const ids = target_ids[room_name]
      //   if (ids.length == 0) {
      //     continue
      //   }

      // }

      // while (!this.target && (squad_memory.target_ids.length > 0)) {
        // this.target = Game.getObjectById(target_ids[0] || '') as Structure | undefined

        // if (this.target) {
        //   break
        // }
        // squad_memory.target_ids.splice(0, 1)
      // }
    }

    this.creeps.forEach((creep) => {
      switch (creep.memory.type) {
        case CreepType.WORKER:
          this.leader = creep
          break

        case CreepType.HEALER:
          this.follower = creep
          break

        default:
          console.log(`InvaderSquad unexpected creep type ${creep.memory.type}, ${this.name}, ${creep.pos}`)
          break
      }
    })

    this.set_next_creep()
  }

  private set_next_creep(): void {
    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    if (!squad_memory || squad_memory.no_spawn) {
      return
    }

    if (!this.leader) {
      if (this.follower) {
        return
      }
      this.next_creep = CreepType.WORKER
      return
    }

    if (!this.follower) {
      this.next_creep = CreepType.HEALER
      return
    }

    if (squad_memory.only_once) {
      squad_memory.no_spawn = true
    }
  }

  public get type(): SquadType {
    return SquadType.INVADER
  }

  public static generateNewName(): string {
    // return UID(SquadType.INVADER)
    return UID('I')
  }

  public generateNewName(): string {
    return InvaderSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)

    if (!squad_memory || squad_memory.stop_spawming) {
      return SpawnPriority.NONE
    }
    if (!squad_memory.target_room_names || (squad_memory.target_room_names.length == 0)) {
      return SpawnPriority.NONE
    }

    switch (this.next_creep) {
      case CreepType.WORKER:
        return SpawnPriority.HIGH

      case CreepType.HEALER:
        return SpawnPriority.URGENT
    }

    return SpawnPriority.NONE
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    switch (this.next_creep) {
      case CreepType.WORKER:
        return energy_available >= 3420

      case CreepType.HEALER:
        return energy_available >= 7620
    }

    return false
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    switch (this.next_creep) {
      case CreepType.WORKER:
        this.addDismantler(energy_available, spawn_func)
        return

      case CreepType.HEALER:
        this.addHealer(energy_available, spawn_func)
        return
    }
  }

  public run(): void {
    this.runDismantler()
    this.runHealer()
  }

  public description(): string {
    const additions = !this.leader ? "" : `, ${this.leader.pos}`
    return `${super.description()}${additions}`
  }

  // --- Private ---
  private addDismantler(energy_available: number, spawn_func: SpawnFunction): void {
    // 3420
    // const body: BodyPartConstant[] = [
    //   TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    //   TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    //   TOUGH, TOUGH,
    //   WORK, WORK, WORK, WORK, WORK,
    //   WORK, WORK, WORK, WORK, WORK,
    //   WORK, WORK, WORK, WORK, WORK,
    //   WORK, WORK, WORK, WORK, WORK,
    //   WORK, WORK, WORK, WORK, WORK,
    //   WORK, WORK, WORK,
    //   MOVE, MOVE, MOVE, MOVE, MOVE,
    //   MOVE, MOVE, MOVE, MOVE, MOVE,
    // ]
    const body: BodyPartConstant[] = [  // no boost
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      TOUGH,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
    ]
    const memory: InvaderMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.WORKER,
      should_notify_attack: false,
      let_thy_die: true,
      pair_id: Game.time,
    }

    this.addGeneralCreep(spawn_func, body, CreepType.WORKER, {memory})
  }

  private addHealer(energy_available: number, spawn_func: SpawnFunction) {
    if (!this.leader || !this.leader.spawning) {
      console.log(`InvaderSquad.addHealer no leader ${this.leader} ${this.name}`)
      return
    }

    // 7620
    // let body: BodyPartConstant[] = [
    //   TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    //   TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
    //   TOUGH, TOUGH,
    //   HEAL, HEAL, HEAL, HEAL, HEAL,
    //   MOVE, MOVE, MOVE, MOVE, MOVE,
    //   MOVE, MOVE, MOVE, MOVE, MOVE,
    //   HEAL, HEAL, HEAL, HEAL, HEAL,
    //   HEAL, HEAL, HEAL, HEAL, HEAL,
    //   HEAL, HEAL, HEAL, HEAL, HEAL,
    //   HEAL, HEAL, HEAL, HEAL, HEAL,
    //   HEAL, HEAL, HEAL,
    // ]
    let body: BodyPartConstant[] = [  // no boost
      TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
      TOUGH,
      HEAL, HEAL, HEAL, HEAL, HEAL,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      HEAL, HEAL, HEAL, HEAL, HEAL,
      HEAL, HEAL, HEAL, HEAL, HEAL,
      HEAL, HEAL, HEAL, HEAL,
    ]

    const pair_id = (this.leader.memory as InvaderMemory).pair_id

    const memory: InvaderMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.HEALER,
      should_notify_attack: false,
      let_thy_die: true,
      pair_id,
    }

    this.addGeneralCreep(spawn_func, body, CreepType.WORKER, {memory})
  }

  private recycle(): void {
    this.creeps.forEach((creep) => {
      if (creep.moveToRoom(this.base_room.name) == ActionResult.IN_PROGRESS) {
        return
      }
      const spawn = creep.room.spawns[0]
      if (!spawn) {
        console.log(`InvaderSpawn.recycle no spawn found in room ${creep.room.name}, ${this.name}, ${creep.pos}`)
        return
      }

      if (spawn.spawning) {
        creep.moveTo(spawn)
        return
      }
      if (spawn.recycleCreep(creep) == ERR_NOT_IN_RANGE) {
        creep.moveTo(spawn)
      }
    })
  }

  private runDismantler() {
    if (!this.leader) {
      return
    }
    const creep = this.leader

    if (!this.target_room_name) {
      this.say(`NO TGT`)
      return
    }

    const can_move = (creep.fatigue == 0) && this.follower && (this.follower.fatigue == 0) && (creep.pos.getRangeTo(this.follower) <= 1)
    if (can_move) {
      if (creep.moveToRoom(this.target_room_name) == ActionResult.IN_PROGRESS) {
        return
      }
    }
    else {
      if (creep.pos.x == 0) {
        creep.move(RIGHT)
      }
      else if (creep.pos.x == 49) {
        creep.move(LEFT)
      }
      if (creep.pos.y == 0) {
        creep.move(BOTTOM)
      }
      else if (creep.pos.y == 49) {
        creep.move(TOP)
      }
      return
    }

    if (this.target) {
      if (creep.dismantle(this.target) == ERR_NOT_IN_RANGE) {
        creep.moveTo(this.target)
      }
    }
    else {
      creep.say(`DONE`)
    }
  }

  private runHealer() {
    if (!this.follower) {
      return
    }
    const creep = this.follower

    if (!this.leader) {
      creep.heal(creep)
      return
    }
    creep.moveTo(this.leader)

    const heal_target = (this.leader.hits < creep.hits) ? this.leader : creep

    if (creep.heal(heal_target) == ERR_NOT_IN_RANGE) {
      if (creep.rangedHeal(heal_target) == ERR_NOT_IN_RANGE) {
        creep.heal(creep)
      }
    }
  }
}

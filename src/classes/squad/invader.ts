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
  lightweight?: boolean
}

export interface InvaderSquadLabs {
  move: StructureLab
  heal: StructureLab
  tough: StructureLab
  dismantle: StructureLab
}

export class InvaderSquad extends Squad {
  private target_room_name: string | undefined
  private target: Structure | undefined

  private leader: Creep | undefined
  private follower: Creep | undefined
  private charger: Creep | undefined
  // 24T, 28W, 28H, 20M
  // XGHO2 * 24 = 720
  // XLHO2 * 28 = 840
  // XZH2O * 28 = 840
  // XZHO2 * 20 = 600

  private next_creep: CreepType | null
  private is_lightweight = false

  constructor(readonly name: string, readonly base_room: Room, readonly labs: InvaderSquadLabs | null) {
    super(name)

    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    if (squad_memory) {
      if (!this.labs) {
        squad_memory.lightweight = true
      }
      this.is_lightweight = squad_memory.lightweight || false

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
    }

    this.creeps.forEach((creep) => {
      switch (creep.memory.type) {
        case CreepType.WORKER:
          this.leader = creep
          break

        case CreepType.HEALER:
          this.follower = creep
          break

        case CreepType.CHARGER:
          this.charger = creep
          break

        default:
          console.log(`InvaderSquad unexpected creep type ${creep.memory.type}, ${this.name}, ${creep.pos}`)
          break
      }
    })

    this.next_creep = this.set_next_creep()
  }

  private set_next_creep(): CreepType | null {
    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    if (!squad_memory || squad_memory.no_spawn) {
      return null
    }

    if ((this.creeps.size == 0) && !this.is_lightweight) {
      return CreepType.CHARGER
    }

    if (!this.leader) {
      if (this.follower) {
        return null
      }
      return CreepType.WORKER
    }

    if (!this.follower) {
      return CreepType.HEALER
    }

    if (squad_memory.only_once) {
      squad_memory.no_spawn = true
    }
    return null
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

      case CreepType.CHARGER:
        return SpawnPriority.HIGH
    }

    return SpawnPriority.NONE
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    switch (this.next_creep) {
      case CreepType.WORKER:
        return energy_available >= 3420

      case CreepType.HEALER:
        return energy_available >= 7620

      case CreepType.CHARGER:
        // 18 CARRYs
        return energy_available >= 1350
    }

    return false
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    switch (this.next_creep) {
      case CreepType.WORKER:
        this.addDismantler(energy_available, spawn_func)
        break

      case CreepType.HEALER:
        this.addHealer(energy_available, spawn_func)
        break

      case CreepType.CHARGER:
        this.addCharger(energy_available, spawn_func)
        break
    }

    this.next_creep = null
  }

  public run(): void {
    this.runDismantler()
    this.runHealer()
    this.runCharger()
  }

  public description(): string {
    const additions = !this.leader ? "" : `, ${this.leader.pos}`
    return `${super.description()}${additions}`
  }

  // --- Private ---
  private addDismantler(energy_available: number, spawn_func: SpawnFunction): void {
    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    let body: BodyPartConstant[]

    if (squad_memory && squad_memory.lightweight) {
      // no boost
      body = [
        TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
      ]
    }
    else {
      // 3420
      // 12T, 28W, 10M
      body = [
        TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
        TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
        TOUGH, TOUGH,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK, WORK, WORK,
        WORK, WORK, WORK,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
      ]
    }

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

    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    let body: BodyPartConstant[]

    if (squad_memory && squad_memory.lightweight) {
      // no boost
      body = [
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
    }
    else {
      // 7620
      // 12T, 28H, 10M
      body = [
        TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
        TOUGH, TOUGH, TOUGH, TOUGH, TOUGH,
        TOUGH, TOUGH,
        HEAL, HEAL, HEAL, HEAL, HEAL,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        MOVE, MOVE, MOVE, MOVE, MOVE,
        HEAL, HEAL, HEAL, HEAL, HEAL,
        HEAL, HEAL, HEAL, HEAL, HEAL,
        HEAL, HEAL, HEAL, HEAL, HEAL,
        HEAL, HEAL, HEAL, HEAL, HEAL,
        HEAL, HEAL, HEAL,
      ]
    }

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

  private addCharger(energy_available: number, spawn_func: SpawnFunction) {
    const body: BodyPartConstant[] = [
      CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
      CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
      CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
      CARRY, CARRY, MOVE, CARRY, CARRY, MOVE,
      CARRY, CARRY, MOVE,
    ]

    this.addGeneralCreep(spawn_func, body, CreepType.CHARGER)
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

      if (spawn.pos.isNearTo(creep)) {
        spawn.recycleCreep(creep)
      }
      else {
        creep.moveTo(spawn)
      }
    })
  }

  private runDismantler(): void {
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
      if (creep.pos.isNearTo(this.target)) {
        creep.dismantle(this.target)
      }
      else {
        creep.moveTo(this.target)
      }
      return
    }

    if (creep.dismantleObjects(this.target_room_name) == ActionResult.IN_PROGRESS) {
      return
    }

    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    if (squad_memory) {
      const index = squad_memory.target_room_names.indexOf(this.target_room_name)
      if (index >= 0) {
        squad_memory.target_room_names.splice(index, 1)
      }

      delete squad_memory.target_ids[this.target_room_name]
    }

    creep.say(`DONE`)
  }

  private runHealer(): void {
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

    if (creep.pos.isNearTo(heal_target)) {
      creep.heal(heal_target)
    }
    else {
      if (creep.rangedHeal(heal_target) == ERR_NOT_IN_RANGE) {
        creep.heal(creep)
      }
    }
  }

  private runCharger(): void {
    console.log(`InvaderSquad.runCharger is not implemented yet ${this.name}`)
  }
}

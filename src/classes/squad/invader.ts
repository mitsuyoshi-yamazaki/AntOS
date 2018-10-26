import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction, TargetSpecifier } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface InvaderMemory extends CreepMemory {
  pair_id: number
}

interface InvaderSquadMemory extends SquadMemory, TargetSpecifier {
  // add at least 4 lab ids to region_memory.reaction_output_excludes
  only_once: boolean    // to not spawn next leader / follower pair
  no_spawn: boolean     // instantiate InvaderSquad but no spawn
  lightweight?: boolean // no boost
  message?: string      // leader.say(message)
  debug?: boolean       // only spawns charger
  manual_targets_only?: boolean // if target_ids[room_name].length == 0 then next room
}

interface BoostInfo {
  resource: ResourceConstant
  lab: StructureLab
  amount: number
  amount_needed: number
}

const boost_resource_tough      = RESOURCE_CATALYZED_GHODIUM_ALKALIDE
const boost_resource_move       = RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE
const boost_resource_dismantle  = RESOURCE_CATALYZED_ZYNTHIUM_ACID
const boost_resource_heal       = RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE

export interface InvaderSquadLabs {
  move: StructureLab
  heal: StructureLab
  tough: StructureLab
  dismantle: StructureLab
}

export class InvaderSquad extends Squad {
  private target_room_name: string | undefined
  private target_room: Room | undefined
  private target: Structure | undefined

  private leader: Creep | undefined
  private follower: Creep | undefined
  private charger: Creep | undefined

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

      if (this.target_room_name) {
        this.target_room = Game.rooms[this.target_room_name] as Room | undefined
        if (this.target_room) {
          const target_ids = (squad_memory.target_ids || {})[this.target_room_name]
          if (target_ids) {
            for (const id of target_ids) {
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

          if (!this.target && squad_memory.manual_targets_only) {
            const index = squad_memory.target_room_names.indexOf(this.target_room_name)
            if (index >= 0) {
              squad_memory.target_room_names.splice(index, 1)
            }
          }
        }
      }
      else {
        if (squad_memory.manual_targets_only) {
          squad_memory.no_spawn = true
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

    if (squad_memory && squad_memory.debug && !squad_memory.no_spawn) {
      this.next_creep = (this.creeps.size < 1) ? CreepType.CHARGER : null
    }
    else {
      this.next_creep = this.set_next_creep()
    }
  }

  private set_next_creep(): CreepType | null {
    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    if (!squad_memory || squad_memory.no_spawn) {
      return null
    }

    if (this.target_room && this.target_room.controller && this.target_room.controller.safeMode) {
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
    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)

    const additions = !this.leader ? "" : `, ${this.leader.pos}`
    const debug = squad_memory && squad_memory.debug ? ' [DEBUG]' : ''
    return `${super.description()}${additions}${debug}`
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

    if (!this.is_lightweight && this.labs && (creep.room.name == this.base_room.name)) {
      const boost_info = creep.boost_info()
      let lab: StructureLab | undefined

      if (!boost_info[MOVE]) {
        lab = this.labs.move
      }
      else if (!boost_info[WORK]) {
        lab = this.labs.dismantle
      }
      else if (!boost_info[TOUGH]) {
        lab = this.labs.tough
      }

      if (lab) {
        if (creep.pos.isNearTo(lab)) {
          lab.boostCreep(creep)
        }
        else {
          creep.moveTo(lab)
        }
        return
      }
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

    const squad_memory = (Memory.squads[this.name] as InvaderSquadMemory)
    if ((creep.room.name == this.target_room_name) && (squad_memory.message)) {
      creep.say(squad_memory.message, true)
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

    if (squad_memory) {
      const index = squad_memory.target_room_names.indexOf(this.target_room_name)
      if (index >= 0) {
        squad_memory.target_room_names.splice(index, 1)
      }

      // delete squad_memory.target_ids[this.target_room_name]
    }

    creep.say(`DONE`)
  }

  private runHealer(): void {
    if (!this.follower) {
      return
    }
    const creep = this.follower

    if (!this.is_lightweight && this.labs && (creep.room.name == this.base_room.name)) {
      const boost_info = creep.boost_info()
      let lab: StructureLab | undefined

      if (!boost_info[MOVE]) {
        lab = this.labs.move
      }
      else if (!boost_info[HEAL]) {
        lab = this.labs.heal
      }
      else if (!boost_info[TOUGH]) {
        lab = this.labs.tough
      }

      if (lab) {
        if (creep.pos.isNearTo(lab)) {
          lab.boostCreep(creep)
        }
        else {
          creep.moveTo(lab)
        }
        return
      }
    }

    if (!this.leader) {
      if (this.target_room_name && (creep.pos.roomName == this.target_room_name)) {
        const nearest_creep = creep.pos.findClosestByPath(FIND_MY_CREEPS)

        if (nearest_creep) {
          creep.moveTo(nearest_creep)

          const heal_target = ((nearest_creep.hitsMax - nearest_creep.hits) <= (creep.hitsMax - creep.hits)) ? nearest_creep : creep

          if (creep.pos.isNearTo(heal_target)) {
            creep.heal(heal_target)
          }
          else {
            if (creep.rangedHeal(heal_target) == ERR_NOT_IN_RANGE) {
              creep.heal(creep)
            }
          }
          return
        }
      }

      creep.heal(creep)
      return
    }

    creep.moveTo(this.leader)

    const heal_target = (this.leader.hits <= creep.hits) ? this.leader : creep

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
    if (!this.charger) {
      return
    }
    const creep = this.charger

    if (!this.labs) {
      creep.say(`NO LABs`)
      return
    }
    if (!this.base_room.terminal) {
      console.log(`InvaderSquad.runCharger no terminal in room ${this.base_room}`)
      return
    }
    const terminal = this.base_room.terminal

    // 24T, 28W, 28H, 20M
    // TOUGH      : XGHO2 * 24 = 720
    // HEAL       : XLHO2 * 28 = 840
    // DISMANTLE  : XZH2O * 28 = 840
    // MOVE       : XZHO2 * 20 = 600

    const boost_info = new Map<BodyPartConstant, BoostInfo>()

    boost_info.set(TOUGH, {
      resource: boost_resource_tough,
      lab: this.labs.tough,
      amount: 720,
      amount_needed: 720,
    })

    boost_info.set(HEAL, {
      resource: boost_resource_heal,
      lab: this.labs.heal,
      amount: 840,
      amount_needed: 840,
    })

    boost_info.set(WORK, {
      resource: boost_resource_dismantle,
      lab: this.labs.dismantle,
      amount: 840,
      amount_needed: 840,
    })

    boost_info.set(MOVE, {
      resource: boost_resource_move,
      lab: this.labs.move,
      amount: 600,
      amount_needed: 600,
    })

    let target_info: BoostInfo | null = null
    let finished = true

    boost_info.forEach((info, body_part) => {
      if (target_info) {
        return
      }
      if (!finished) {
        return
      }

      if (!info.lab) {
        console.log(`InvaderSquad.runCharger unexpectedly found null lab ${body_part}, ${this.name}`)
        return
      }
      if ((info.lab.mineralType == info.resource) && (info.lab.mineralAmount >= info.amount_needed)) {
        return
      }

      if (info.lab.mineralType == info.resource) {
        info.amount_needed -= info.lab.mineralAmount
      }

      if ((terminal.store[info.resource] || 0) < info.amount_needed) {
        const rooms = [
          'W43S5',
          'W44S7',
          'W47S6',
          'W48S6',
          'W51S29',
        ]

        Game.send_resource(rooms, this.base_room.name, info.resource, info.amount_needed)

        finished = false
        return
      }

      target_info = info
    })

    if (!target_info) {
      if (finished) {
        creep.say(`DONE`)
      }
      else {
        creep.say(`WIP`)
      }
      return
    }

    this.runChargerCreep(creep, target_info, terminal)
  }

  private runChargerCreep(creep: Creep, target_info: BoostInfo, terminal: StructureTerminal): void {
    const carry = _.sum(creep.carry)

    if ((creep.ticksToLive || 0) < 15) {
      if (carry <= 0) {
        return
      }
      if (creep.transferResources(terminal) == ERR_NOT_IN_RANGE) {
        creep.moveTo(terminal)
      }
      return
    }

    let result: ScreepsReturnCode = OK

    if ([CreepStatus.HARVEST, CreepStatus.CHARGE].indexOf(creep.memory.status) < 0) {
      creep.memory.status = CreepStatus.HARVEST
    }

    if (target_info.lab.mineralType && (target_info.lab.mineralType != target_info.resource)) {
      creep.memory.status = CreepStatus.HARVEST
    }

    if (creep.memory.status == CreepStatus.HARVEST) {
      // Withdraw from lab

      if (carry == 0) {
        if ((!target_info.lab.mineralType)) {
          creep.memory.status = CreepStatus.CHARGE
        }
        else if (target_info.lab.mineralType == target_info.resource) {
          creep.memory.status = CreepStatus.CHARGE
        }
        else {
          if (creep.pos.isNearTo(target_info.lab)) {
            result = creep.withdraw(target_info.lab, target_info.lab.mineralType!)
          }
          else {
            creep.moveTo(target_info.lab)
          }
        }
      }
      else {
        if (creep.pos.isNearTo(terminal)) {
          result = creep.transferResources(terminal)
        }
        else {
          creep.moveTo(terminal)
        }
      }
    }

    if (creep.memory.status == CreepStatus.CHARGE) {
      // Charge to lab from terminal

      if (carry == 0) {
        if (creep.pos.isNearTo(terminal)) {
          result = creep.withdraw(terminal, target_info.resource, target_info.amount_needed)
        }
        else {
          creep.moveTo(terminal)
        }
      }
      else {
        if (creep.pos.isNearTo(target_info.lab)) {
          result = creep.transfer(target_info.lab, target_info.resource)
        }
        else {
          creep.moveTo(target_info.lab)
        }
      }
    }

    if (result != OK) {
      creep.say(`E${result}`)
      console.log(`InvaderSquad.runChargerCreep [ERROR] ${creep.memory.status}, result: ${result}, ${this.name}`)

      if (creep.memory.status == CreepStatus.HARVEST) {
        creep.memory.status = CreepStatus.CHARGE
      }
      else {
        creep.memory.status = CreepStatus.HARVEST
      }
    }
  }
}

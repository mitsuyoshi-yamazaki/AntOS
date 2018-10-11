import { UID } from "classes/utils"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "classes/creep"

interface ManualMemory extends CreepMemory {
  target_id?: string
  target_ids?: string[]
  target_room?: string
  target_x?: number
  target_y?: number
  search_and_destroy?: boolean
  repairing_structure_id?: string
  history?: string[]
}

interface ManualSquadMemory extends SquadMemory {
  claimer_last_spawned?: number
  dismantle_room_name?: string
}

type MineralContainer = StructureTerminal | StructureStorage | StructureContainer
type MineralStore = MineralContainer | StructurePowerSpawn

export class ManualSquad extends Squad {
  private any_creep: Creep | undefined

  private attackers: Creep[] = []
  private workers: Creep[] = []
  private target_id?: string
  private desc?: string

  constructor(readonly name: string, readonly original_room_name: string, readonly base_room: Room) {
    super(name)

    this.any_creep = Array.from(this.creeps.values())[0]

    this.creeps.forEach((creep) => {
      switch (creep.memory.type) {
        case CreepType.ATTACKER:
          this.attackers.push(creep)
          break

        case CreepType.WORKER:
          this.workers.push(creep)
          break
      }
    })
  }

  public get type(): SquadType {
    return SquadType.MANUAL
  }

  public get spawnPriority(): SpawnPriority {
    const memory = Memory.squads[this.name] as ManualSquadMemory

    if (memory.stop_spawming) {
      return SpawnPriority.NONE
    }

    switch (this.original_room_name) {
      case 'W51S29': {
        const room = Game.rooms[this.original_room_name]
        if (!room || !room.storage || (room.storage.store.energy < 200000)) {
          return SpawnPriority.NONE
        }

        const lab_id = '5b258a00a84f8b52880bff57'
        const lab = Game.getObjectById(lab_id) as StructureLab | undefined
        const link = Game.getObjectById('5b25ad0900c9b15f092dfa9c') as StructureLink | undefined

        if (!lab || !link) {
          this.say(`NO LAB`)
          console.log(`ManualSquad.run no lab nor link for ${lab_id} ${this.name} ${this.original_room_name} `)
          return SpawnPriority.NONE
        }
        if ((lab.mineralType != RESOURCE_LEMERGIUM_HYDRIDE) || (lab.mineralAmount < 300)) {
          return SpawnPriority.NONE
        }

        return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
        // return SpawnPriority.NONE
      }

      case 'W44S7': {
        const target_rooms: {[room_name: string]: boolean} = {
          W39S7: false,
          W38S7: false,
          W38S6: false,
          W38S5: false
        }
        const room = Game.rooms[this.original_room_name]
        if (!room || !room.terminal || !room.storage) {
          return SpawnPriority.NONE
        }

        this.creeps.forEach((creep) => {
          const creep_memory = creep.memory as ManualMemory
          if (!creep_memory.target_id) {
            return
          }

          if (target_rooms[creep_memory.target_id] != null) {
            target_rooms[creep_memory.target_id] = true
          }
        })

        for (const room_name in target_rooms) {
          const has_creep = target_rooms[room_name]
          if (has_creep == null) {
            continue
          }
          if (!has_creep) {
            this.target_id = room_name
            this.desc = `next: ${room_name}`
            return SpawnPriority.LOW
          }
        }

        return SpawnPriority.NONE
      }

      case 'W43S5': {
        // const target_room_memory = Memory.rooms['W45S5']
        // if (target_room_memory && target_room_memory.attacked_time) {
        //   return SpawnPriority.NONE
        // }
        // return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
        return SpawnPriority.NONE
      }

      case 'W48S6': {
        const target_room_name = 'W49S6'
        const room = Game.rooms[target_room_name]
        if (!room) {
          return SpawnPriority.NONE
        }
        if (room.controller && room.controller.my && (room.controller.level >= 3)) {
          return SpawnPriority.NONE
        }

        return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
      }

      case 'W47S9': {
        const target_room_name = 'W55S12'
        const target_room = Game.rooms[target_room_name]
        if (!target_room || !target_room.storage || (target_room.storage.store.energy < 4000)) {
          return SpawnPriority.NONE
        }

        return this.creeps.size < 4 ? SpawnPriority.LOW : SpawnPriority.NONE
      }

      case 'W45S3': {
        const target_room_name = 'W44S3'
        const target_room = Game.rooms[target_room_name]
        if (!target_room || !target_room.terminal || (_.sum(target_room.terminal.store) == 0)) {
          return SpawnPriority.NONE
        }

        return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
      }

      case 'W46S3': {
        const target_room_name = 'W45S3'
        const target_room = Game.rooms[target_room_name]
        if (!target_room || !target_room.controller || (target_room.controller.level >= 6)) {
          return SpawnPriority.NONE
        }

        return this.creeps.size < 3 ? SpawnPriority.LOW : SpawnPriority.NONE
      }

      case 'E16N37': {
        const target_room_name = 'E15N37'
        const room = Game.rooms[target_room_name]
        if (!room) {
          return SpawnPriority.NONE
        }
        if ((!room.storage || (_.sum(room.storage.store) == 0)) && (!room.terminal || (_.sum(room.terminal.store) == 0))) {
          return SpawnPriority.NONE
        }

        return this.creeps.size < 4 ? SpawnPriority.LOW : SpawnPriority.NONE
      }

      case 'W56S7': {
        return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
      }

      case 'W53S15': {
        if (!this.base_room.storage || this.base_room.storage.my || (_.sum(this.base_room.storage.store) == 0)) {
          return SpawnPriority.NONE
        }
        return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
      }

      default:
        return SpawnPriority.NONE
    }
  }

  public static generateNewName(): string {
    return UID('M')
  }

  public generateNewName(): string {
    return ManualSquad.generateNewName()
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    switch (this.original_room_name) {
      case 'W49S34':
        if (this.attackers.length == 0) {
          return energy_available >= 1240
        }
        else if ((this.attackers.length < 2) && !this.attackers[0].spawning && ((this.attackers[0].ticksToLive || 1000) < 550)) {
          return energy_available >= 1240
        }
        return energy_available >= 2250 // worker

      case 'W49S48':
        return energy_available >= 150

      case 'W48S47':
        return energy_available >= 300

      case 'W49S47':
        return energy_available >= 200

      case 'W51S29':
        return energy_available >= 1150

      case 'W49S26':
        return energy_available >= 1600

      case 'W44S7':
        // if (this.target_id == 'W38S5') {
          return energy_available >= 2600
        // }
        // return energy_available >= 1950

      case 'W43S5':
        return this.hasEnoughEnergyForLightWeightHarvester(energy_available, capacity)

      case 'W48S6':
        return energy_available > 2020

      case 'W47S9': {
        return energy_available > 2500
      }

      case 'W45S3': {
        return energy_available > 1500
      }

      case 'W46S3': {
        return energy_available >= 850
      }

      case 'E16N37': {
        return energy_available >= 1500
      }

      case 'W56S7': {
        return energy_available >= 2100
      }

      case 'W53S15': {
        return energy_available > 1500
      }

      default:
        return false
    }
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    switch (this.original_room_name) {
      case 'W49S34': {
        const attacker_body: BodyPartConstant[] = [
          TOUGH, MOVE, TOUGH, MOVE,
          ATTACK, MOVE, ATTACK, MOVE,
          ATTACK, MOVE, ATTACK, MOVE,
          MOVE, MOVE, HEAL, HEAL
        ]
        if (this.attackers.length == 0) {
          this.addGeneralCreep(spawn_func, attacker_body, CreepType.ATTACKER)
          return
        }
        else if ((this.attackers.length < 2) && !this.attackers[0].spawning && ((this.attackers[0].ticksToLive || 1000) < 550)) {
          this.addGeneralCreep(spawn_func, attacker_body, CreepType.ATTACKER)
          return
        }
        const worker_body: BodyPartConstant[] = [
          WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
          WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
          WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
        ]
        this.addGeneralCreep(spawn_func, worker_body, CreepType.WORKER)
        return
      }

      case 'W49S48':
        this.addCarrier(energy_available, spawn_func)
        return

      case 'W48S47':
        this.addGeneralCreep(spawn_func, [MOVE, MOVE, CARRY, CARRY, CARRY, MOVE], CreepType.CARRIER)
        return

      case 'W49S47':
        this.addGeneralCreep(spawn_func, [MOVE, MOVE, CARRY, CARRY], CreepType.CARRIER)
        return

      case 'W51S29': {
        this.addUpgrader(energy_available, spawn_func, CreepType.WORKER, {max_energy: 1150})
        return
      }

      case 'W49S26': {
        const body: BodyPartConstant[] = [
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          MOVE,
        ]
        this.addGeneralCreep(spawn_func, body, CreepType.CARRIER)
        return
      }

      case 'W48S6': {
        const body: BodyPartConstant[] = [
          TOUGH, TOUGH,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
          HEAL, HEAL, HEAL,
        ]

        this.addGeneralCreep(spawn_func, body, CreepType.RANGED_ATTACKER)
        return
      }

      case 'W44S7': {
        let body: BodyPartConstant[] = [
          CLAIM, CLAIM, CLAIM, CLAIM,
          MOVE, MOVE, MOVE, MOVE,
        ]

        // if (this.target_id == 'W38S5') {
        //   body = [
        //     CLAIM, CLAIM, CLAIM, CLAIM,
        //     MOVE, MOVE, MOVE, MOVE,
        //   ]
        // }
        const name = this.generateNewName()
        const memory: ManualMemory = {
          squad_name: this.name,
          status: CreepStatus.NONE,
          birth_time: Game.time,
          type: CreepType.CLAIMER,
          should_notify_attack: false,
          let_thy_die: true,
          target_id: this.target_id,
        }

        if (!this.target_id) {
          console.log(`ManualSquad.addCreep error no target id`)
        }

        const result = spawn_func(body, name, {
          memory: memory
        })
        return
      }

      case 'W43S5': {
        this.addLightWeightHarvester(energy_available, spawn_func)
        return
      }

      case 'W47S9': {
        // carrier
        const body: BodyPartConstant[] = [
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          MOVE, MOVE, MOVE, MOVE, MOVE,
        ]
        this.addGeneralCreep(spawn_func, body, CreepType.WORKER)
        return
      }

      case 'W45S3': {
        // carrier
        const body: BodyPartConstant[] = [
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE, // 5
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE, // 10
        ]
        this.addGeneralCreep(spawn_func, body, CreepType.CARRIER)
        return
      }

      case 'W46S3': {
        const body_unit: BodyPartConstant[] = [
          CARRY, CARRY, MOVE
        ]
        const energy_unit = 150

        const name = this.generateNewName()
        let body: BodyPartConstant[] = []
        const memory: CreepMemory = {
          squad_name: this.name,
          status: CreepStatus.NONE,
          birth_time: Game.time,
          type: CreepType.CARRIER,
          should_notify_attack: false,
          let_thy_die: true,
        }

        energy_available = Math.min(energy_available, (energy_unit * 16))

        while (energy_available >= energy_unit) {
          body = body.concat(body_unit)
          energy_available -= energy_unit
        }

        const result = spawn_func(body, name, {
          memory: memory
        })
        return
      }

      case 'E16N37': {
        const body: BodyPartConstant[] = [
          MOVE, MOVE, MOVE, MOVE, MOVE,
          // MOVE, MOVE, MOVE, MOVE, MOVE,
          // MOVE, MOVE, MOVE, MOVE, MOVE,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          MOVE, MOVE, MOVE, MOVE, MOVE,
        ]
        this.addGeneralCreep(spawn_func, body, CreepType.CARRIER)
        return
      }

      case 'W56S7': {
        const body: BodyPartConstant[] = [
          MOVE, MOVE, MOVE,
          CLAIM, CLAIM, CLAIM,
          MOVE, MOVE, MOVE,
        ]
        this.addGeneralCreep(spawn_func, body, CreepType.CLAIMER)
        return
      }

      case 'W53S15': {
        // carrier
        const body: BodyPartConstant[] = [
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE, // 5
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE,
          CARRY, CARRY, MOVE, // 10
        ]
        this.addGeneralCreep(spawn_func, body, CreepType.CARRIER)
        return
      }

      default:
        return
    }
  }

  public run(): void {
    const squad_memory = Memory.squads[this.name] as ManualSquadMemory
    if (squad_memory.dismantle_room_name) {
      if (this.dismantle(squad_memory.dismantle_room_name) == ActionResult.DONE) {
        (Memory.squads[this.name] as ManualSquadMemory).dismantle_room_name = undefined
      }
      return
    }

    switch (this.original_room_name) {

      case 'W51S29': {
        const lab_id = '5b258a00a84f8b52880bff57'
        const lab = Game.getObjectById(lab_id) as StructureLab | undefined

        const link = Game.getObjectById('5b25ad0900c9b15f092dfa9c') as StructureLink | undefined

        this.creeps.forEach((creep) => {
          const memory = creep.memory as ManualMemory

          if (!creep.boosted() && lab && (lab.mineralType == RESOURCE_LEMERGIUM_HYDRIDE) && (lab.mineralAmount >= 300)) {
            if (lab.boostCreep(creep) == ERR_NOT_IN_RANGE) {
              creep.moveTo(lab)
            }
            return
          }

          const x = 14
          const y = 20

          if (!creep.memory.stop) {
            creep.moveTo(x, y)
          }
          if ((creep.pos.x != x) || (creep.pos.y != y)) {
            return
          }

          if (!link) {
            creep.say(`NO LNK`)
            return
          }

          const withdraw_result = creep.withdraw(link, RESOURCE_ENERGY)

          let target: StructureWall | StructureRampart | undefined

          if (memory.target_id && ((Game.time % 29) != 7)) {
            target = Game.getObjectById(memory.target_id) as StructureWall | StructureRampart | undefined
          }

          if (!target) {
            const walls = creep.pos.findInRange(FIND_STRUCTURES, 3, {
              filter: (structure: Structure) => {
                return (structure.structureType == STRUCTURE_WALL) || (structure.structureType == STRUCTURE_RAMPART)
              }
            }) as (StructureWall | StructureRampart)[]

            target = walls.sort(((lhs, rhs) => {
              const l_hits = Math.floor(lhs.hits / 100000)
              const r_hits = Math.floor(rhs.hits / 100000)
              if (l_hits < r_hits) return -1
              else if (l_hits > r_hits) return 1
              else return 0
            }))[0]
          }

          if (!target) {
            creep.say(`NO TGT`)
            return
          }

          (creep.memory as ManualMemory).target_id = target.id

          const repair_result = creep.repair(target)
          if (repair_result != OK) {
            creep.say(`E${repair_result}`)
          }
          else {
            creep.say(`${Math.floor(target.hits / 1000)}k`)
          }
        })
        return
      }

    case 'W49S26':{
      // const base_room_name = this.original_room_name
      // const target_room_name = 'W49S27'

      // this.creeps.forEach((creep) => {
      //   if ((creep.room.name == 'W51S29') && (creep.carry.energy  == 0)) {
      //     const room = Game.rooms['W51S29']

      //     if (creep.withdraw(room.terminal!, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
      //       creep.moveTo(room.terminal!)
      //       return
      //     }
      //     return
      //   }
      // })

      // if (this.stealEnergyFrom(base_room_name, target_room_name, 7, 38, false) == ActionResult.IN_PROGRESS) {
      //   return
      // }
      const next_squad_name = 'manual4919'
      this.creeps.forEach((creep) => {
        creep.memory.squad_name = next_squad_name
      })
      return
    }
      case 'W48S19': {
        const worker_squad_name = 'worker71825555'
        if (this.dismantle('W49S19') == ActionResult.IN_PROGRESS) {
          return
        }
        this.creeps.forEach((creep) => {
          creep.memory.squad_name = worker_squad_name
        })
        return
      }

      case 'W48S12':{
        this.dismantle('W42S4')
        return
      }

      case 'W49S19': {
        this.creeps.forEach((creep) => {
          creep.memory.let_thy_die = false
        })

        const base_room_name = this.original_room_name
        const target_room_name = 'W49S18'

        this.stealEnergyFrom(this.original_room_name, target_room_name, 20, 33, {should_die: true})

        this.renewIfNeeded()
        return
      }

      case 'W44S7': {
        this.creeps.forEach((creep) => {
          const creep_memory = creep.memory as ManualMemory
          if (!creep_memory || !creep_memory.target_id) {
            console.log(`ManualSquad.run ${this.original_room_name} error no target room name ${creep.name} ${creep.pos}`)
            return
          }

          const room_name = creep_memory.target_id
          creep.claim(room_name)
        })
        return
      }

      case 'W43S5': {
        this.creeps.forEach((creep) => {
          (creep.memory as {target_id?: string}).target_id = '5a412a0d45b7612ba7ee5934'
        })

        this.dismantle('W42N3')
        return
      }

      case 'W48S6': {
        const target_room_name = 'W49S6'

        this.creeps.forEach((creep) => {
          creep.searchAndDestroyTo(target_room_name, true)
        })
        return
      }

      case 'W47S9': {
        this.stealEnergyFrom('W55S13', 'W55S12', 18, 17)
        return
      }

      case 'W45S3': {
        this.stealEnergyFrom('W45S3', 'W44S3', 18, 17)
        return
      }

      case 'W46S3': {
        if (!this.base_room || !this.base_room.storage) {
          console.log(`ManualSquad.run no base room ${this.original_room_name}, ${this.name}`)
          this.say(`NO SRC`)
          return
        }

        const storage = this.base_room.storage
        const target_room_name = 'W45S3'
        const target_room = Game.rooms[target_room_name]
        if (!target_room) {
          console.log(`ManualSquad.run no target room ${target_room_name}, ${this.name}`)
          this.say(`ERR`)
          return
        }

        const target_pos = new RoomPosition(19, 41, target_room_name)

        this.creeps.forEach((creep) => {
          if (creep.carry.energy == 0) {
            if (creep.pos.isNearTo(storage)) {
              creep.withdraw(storage, RESOURCE_ENERGY)
            }
            else {
              creep.moveTo(storage)
            }
          }
          else {
            if (target_room.storage) {
              if (creep.pos.isNearTo(target_room.storage)) {
                creep.transfer(target_room.storage, RESOURCE_ENERGY)
              }
              else {
                creep.moveTo(target_room.storage)
              }
            }
            else {
              if ((creep.pos.x == target_pos.x) && (creep.pos.y == target_pos.y) && (creep.room.name == target_pos.roomName)) {
                creep.drop(RESOURCE_ENERGY)
              }
              else {
                creep.moveTo(target_pos)
              }
            }
          }
        })
        return
      }

      case 'E16N37': {
        const target_room_name = 'E15N37'
        this.stealEnergyFrom(this.original_room_name, target_room_name, 14, 29, {ticks_to_return: 120, worker_squad_name: 'worker_e16n37'})
        return
      }

      case 'W56S7': {
        const target_room_name = 'W58S4'

        this.creeps.forEach((creep) => {
          if (creep.moveToRoom(target_room_name) == ActionResult.IN_PROGRESS) {
            return
          }

          if (!creep.room.controller) {
            creep.say(`ERR`)
            return
          }

          if (creep.reserveController(creep.room.controller) == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller)
          }
        })

        return
      }

      case 'W54S7': {
        this.creeps.forEach((creep) => {
          creep.dismantleObjects('W54S8', {include_wall: true})

        })
        return
      }

      case 'W53S15': {
        if (!this.base_room.storage || this.base_room.storage.my || (_.sum(this.base_room.storage.store) == 0)) {
          this.say(`DONE`)
          if ((Game.time % 1499) == 1) {
            Game.notify(`${this.original_room_name} no more resources in storage`)
          }
          return
        }
        if (!this.base_room.terminal) {
          this.say(`ERR`)
          return
        }

        const storage = this.base_room.storage
        const terminal = this.base_room.terminal

        this.creeps.forEach((creep) => {
          const carry = _.sum(creep.carry)

          if (carry == 0) {
            if (creep.pos.isNearTo(storage.pos)) {
              creep.withdrawResources(storage)
            }
            else {
              creep.moveTo(storage)
            }
          }
          else {
            if (creep.pos.isNearTo(terminal.pos)) {
              creep.transferResources(terminal)
            }
            else {
              creep.moveTo(terminal)
            }
          }
        })
        return
      }

      case 'W53S5': {
        this.creeps.forEach((creep) => {
          creep.moveTo(9, 48)
        })
        return
      }

      default:
        if (this.creeps.size > 0) {
          this.say(`NO SCR`)
          console.log(`ManualSquad.run error no script for ${this.original_room_name}`)
        }
        return
    }
  }

  public description(): string {
    const addition = this.creeps.size > 0 ? `, ${Array.from(this.creeps.values())[0].pos}` : ''
    return `${super.description()} ${this.desc || addition}`
  }


  // --- Private ---
  private addWorker(energy_available: number, spawn_func: SpawnFunction): void {
    const energy_unit = 200
    let body_unit: BodyPartConstant[] = [WORK, CARRY, MOVE]

    let body: BodyPartConstant[] = []
    const name = this.generateNewName()
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.WORKER,
      should_notify_attack: false,
      let_thy_die: false,
    }

    energy_available = Math.min(energy_available, 1400)

    while (energy_available >= energy_unit) {
      body = body.concat(body_unit)
      energy_available -= energy_unit
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  private addClaimer(energy_available: number, spawn_func: SpawnFunction): ScreepsReturnCode {
    const name = this.generateNewName()
    const body: BodyPartConstant[] = [
      CLAIM, MOVE, CLAIM, MOVE
    ]
    const memory: ManualMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CLAIMER,
      should_notify_attack: false,
      let_thy_die: true,
      history: []
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
    return result
  }

  public addCarrier(energy_available: number, spawn_func: SpawnFunction): ScreepsReturnCode {
    const name = this.generateNewName()
    const body: BodyPartConstant[] = [
      CARRY, CARRY, MOVE
    ]
    const memory: ManualMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CARRIER,
      should_notify_attack: false,
      let_thy_die: true,
      history: []
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
    return result
  }

  public addRangedHunter(energy_available: number, spawn_func: SpawnFunction): ScreepsReturnCode {
    const name = this.generateNewName()
    const body: BodyPartConstant[] = [
      TOUGH, MOVE, TOUGH, MOVE,
      TOUGH, MOVE, TOUGH, MOVE,
      RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE,  // 5
      RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE,  // 10
      HEAL, MOVE, HEAL, MOVE,
      HEAL, MOVE, HEAL, MOVE,
      HEAL, MOVE, HEAL, MOVE,
    ]
    const memory: ManualMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.ATTACKER,
      should_notify_attack: false,
      let_thy_die: true,
      history: []
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
    return result
  }

  public addLightWeightHarvester(energy_available: number, spawn_func: SpawnFunction): void {
    const body_unit: BodyPartConstant[] = [WORK, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE]
    const energy_unit = 450
    energy_available = Math.min(energy_available, 2250)

    const name = this.generateNewName()
    let body: BodyPartConstant[] = []
    const memory: ManualMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.HARVESTER,
      should_notify_attack: false,
      let_thy_die: false,
      history: [],
    }

    while (energy_available >= energy_unit) {
      body = body.concat(body_unit)
      energy_available -= energy_unit
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  private addHealer(energyAvailable: number, spawnFunc: SpawnFunction): void {
    const name = this.generateNewName()
    const body: BodyPartConstant[] = [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      HEAL, HEAL, HEAL, HEAL, HEAL, HEAL,
      MOVE,
    ]
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.HEALER,
      should_notify_attack: false,
      let_thy_die: true,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })
  }

  private addAttacker(energyAvailable: number, spawnFunc: SpawnFunction): void {

    const name = this.generateNewName()
    const body: BodyPartConstant[] = [
      RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
      RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
      ATTACK, MOVE, ATTACK, MOVE,
      ATTACK, MOVE, ATTACK, MOVE,
      ATTACK, MOVE, ATTACK, MOVE,
      ATTACK, MOVE, ATTACK, MOVE,
      ATTACK, MOVE, ATTACK, MOVE,
      HEAL, MOVE,
      HEAL, MOVE,
      HEAL, MOVE,
      HEAL, MOVE,
      HEAL, MOVE,
    ]
    const memory: CreepMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.ATTACKER,
      should_notify_attack: false,
      let_thy_die: true,
    }

    const result = spawnFunc(body, name, {
      memory: memory
    })
  }


  // ---
  private spawnPriorityForBoostCarrier(resource_type: ResourceConstant): SpawnPriority {
    const room = Game.rooms[this.original_room_name]
    if (!room || !room.terminal) {
      return SpawnPriority.NONE
    }

    if ((room.terminal.store[resource_type] || 0) < 100) {
      return SpawnPriority.NONE
    }
    return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
  }

  private renewIfNeeded(): void {
    this.creeps.forEach((creep) => {
      const needs_renew = !creep.memory.let_thy_die && ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) || (((creep.ticksToLive || 0) < 350) && (creep.carry.energy > (creep.carryCapacity * 0.8))))// !creep.memory.let_thy_die && ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) || ((creep.ticksToLive || 0) < 300))

      if (needs_renew) {
        if ((creep.room.spawns.length > 0) && ((creep.room.energyAvailable > 40) || ((creep.ticksToLive ||0) > 400)) && !creep.room.spawns[0].spawning) {
          creep.goToRenew(creep.room.spawns[0])
          return
        }
        else if (creep.memory.status == CreepStatus.WAITING_FOR_RENEW) {
          creep.memory.status = CreepStatus.HARVEST
        }
      }
    })
  }

  private runAttacker() {
    const lab = Game.getObjectById('5afb5a00c41b880caa6c3058') as StructureLab | undefined
    const target_room_name = 'W45S41'

    this.creeps.forEach((creep) => {
      (creep.memory as {target_id?: string}).target_id = '5ac2d005bc88a23950950fe4'

      if (!creep.boosted() && lab && (lab.mineralType == RESOURCE_UTRIUM_ACID)) {
        if (lab.boostCreep(creep) == ERR_NOT_IN_RANGE) {
          creep.moveTo(lab)
          creep.heal(creep)
          return
        }
      }

      if (creep.room.name != target_room_name) {
        const hostile_creep = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4)[0]

        if (hostile_creep) {
          creep.destroy(hostile_creep)
          return
        }
      }

      if (creep.moveToRoom(target_room_name) == ActionResult.IN_PROGRESS) {
        creep.heal(creep)
        return
      }

      creep.searchAndDestroy()
    })
  }

  private runForcedScout() {
    const target_room_name = 'W48S42'
    const waypoint_1 = 'W49S45'
    const waypoint_2 = 'W47S42'

    let first_creep = true

    this.creeps.forEach((creep) => {
      this.creeps.forEach((creep) => {
        creep.moveTo(16, 8)
      })

      const memory = creep.memory as ManualMemory

      if (!memory.target_id) {
        (creep.memory as ManualMemory).target_id = waypoint_1
      }
      else if (memory.target_id == waypoint_1) {
        if (creep.moveToRoom(waypoint_1) == ActionResult.IN_PROGRESS) {
          return
        }
        (creep.memory as ManualMemory).target_id = waypoint_2
      }
      else if (memory.target_id == waypoint_2) {
        if (creep.moveToRoom(waypoint_2) == ActionResult.IN_PROGRESS) {
          return
        }
        if (first_creep) {
          first_creep = false
        }
        else {

        }
      }
    })
  }

  private transferMineralToLab(from: MineralContainer, to: StructureLab, resource_type: ResourceConstant): void {
    if (!from || !to || !resource_type) {
      const message = `ManualSquad.transferMineralToLab invalid args ${this.name} ${this.original_room_name}`
      console.log(message)
      Game.notify(message)
      return
    }

    this.creeps.forEach((creep) => {
      if (!creep.hasActiveBodyPart(CARRY)) {
        console.log(`ManualSquad.transferMineralToLab no CARRY body parts  ${this.name}`)
        creep.say(`ERROR`)
        return
      }

      if ((to.mineralType != resource_type) && (to.mineralType != null)) {
        if (_.sum(creep.carry) > 0) {
          if (creep.transferResources(from) == ERR_NOT_IN_RANGE) {
            creep.moveTo(from)
          }
          return
        }
        if (creep.withdraw(to, to.mineralType) == ERR_NOT_IN_RANGE) {
          creep.moveTo(to)
        }
        return
      }

      if ((to.mineralAmount == to.mineralCapacity)) {
        if ((_.sum(creep.carry) > 0)) {
          if (creep.transferResources(from) == ERR_NOT_IN_RANGE) {
            creep.moveTo(from)
          }
        }
        else {
          return
        }
        return
      }

      if (creep.memory.status == CreepStatus.CHARGE) {
        if ((creep.carry[resource_type] || 0) == 0) {
          if (_.sum(creep.carry) > 0) {
            if (creep.transferResources(from) == ERR_NOT_IN_RANGE) {
              creep.moveTo(from)
            }
            return
          }
          creep.memory.status = CreepStatus.HARVEST
          return
        }

        if (creep.transfer(to, resource_type) == ERR_NOT_IN_RANGE) {
          creep.moveTo(to)
        }
      }
      else {
        if ((creep.carry[resource_type] || 0) == 0) {
          if (_.sum(creep.carry) > 0) {
            if (creep.transferResources(from) == ERR_NOT_IN_RANGE) {
              creep.moveTo(from)
            }
            return
          }
        }

        creep.memory.status = CreepStatus.HARVEST

        if (_.sum(creep.carry) == creep.carryCapacity) {
          creep.memory.status = CreepStatus.CHARGE
          return
        }

        const amount = Math.min(creep.carryCapacity, (to.mineralCapacity - to.mineralAmount))
        const result = creep.withdraw(from, resource_type, amount)

        switch (result) {
          case OK:
            creep.memory.status = CreepStatus.CHARGE
            break

          case ERR_NOT_IN_RANGE:
            creep.moveTo(from)
            break

          case ERR_NOT_ENOUGH_RESOURCES:
            if (_.sum(creep.carry) == 0) {
              creep.say(`DONE`)
            }
            else {
              creep.memory.status = CreepStatus.CHARGE
            }
            break

          default:
            creep.say(`ERROR`)
            console.log(`ManualSquad.transferMineral unknown withdraw error ${result}, ${this.name}, ${creep.name}, ${from}`)
            break
        }
      }
    })
  }

  private transferMineral(from: MineralContainer, to: MineralStore, resource_type: ResourceConstant): void {
    // const switch_structure = function(structure: MineralContainer, case_lab: (lab: StructureLab) => void, case_other: (structure: {store: StoreDefinition}) => void): void {
    //   if ((structure as StructureLab).mineralCapacity) {
    //     case_lab((structure as StructureLab))
    //   }
    //   else {
    //     case_other(structure as {store: StoreDefinition})
    //   }
    // }

    this.creeps.forEach((creep) => {
      if (!creep.hasActiveBodyPart(CARRY)) {
        console.log(`ManualSquad.transferMineral no CARRY body parts`)
        creep.say(`ERROR`)
        return
      }
      if (creep.memory.status == CreepStatus.CHARGE) {
        if (_.sum(creep.carry) == 0) {
          creep.memory.status = CreepStatus.HARVEST
          return
        }

        if (to.structureType == STRUCTURE_POWER_SPAWN) {
          if (resource_type == RESOURCE_POWER) {
            if (creep.transfer(to, resource_type) == ERR_NOT_IN_RANGE) {
              creep.moveTo(to)
            }
          }
          else {
            console.log(`ManualSquad.run failed ${resource_type} cannot be transfered to PowerSpawn ${to} ${this.original_room_name}`)
          }
          return
        }
        if (creep.transferResources(to) == ERR_NOT_IN_RANGE) {
          creep.moveTo(to)
        }
      }
      else {
        creep.memory.status = CreepStatus.HARVEST

        if (_.sum(creep.carry) == creep.carryCapacity) {
          creep.memory.status = CreepStatus.CHARGE
          return
        }

        const result = creep.withdraw(from, resource_type)

        switch (result) {
          case OK:
            break

          case ERR_NOT_IN_RANGE:
            creep.moveTo(from)
            break

          case ERR_NOT_ENOUGH_RESOURCES:
            if (_.sum(creep.carry) == 0) {
              creep.say(`DONE`)
            }
            else {
              creep.memory.status = CreepStatus.CHARGE
            }
            break

          default:
            creep.say(`ERROR`)
            console.log(`ManualSquad.transferMineral unknown withdraw error ${result}, ${this.name}, ${creep.name}, ${from}`)
            break
        }
      }
    })
  }

  private withdrawFromLabs(): void {
    this.creeps.forEach((creep) => {
      if (_.sum(creep.carry) > 0) {
        const resource_type = creep.carrying_resources()[0]
        if (creep.transfer(creep.room.terminal!, resource_type) == ERR_NOT_IN_RANGE) {
          creep.moveTo(creep.room.terminal!)
        }
        return
      }

      const target = creep.room.find(FIND_STRUCTURES, {
        filter: (structure) => {
          return ((structure.structureType == STRUCTURE_LAB) && (structure.mineralAmount > 0))
        }
      })[0] as StructureLab | undefined

      if (!target) {
        creep.say("😴")
        return
      }

      if (creep.withdraw(target, target.mineralType as ResourceConstant) == ERR_NOT_IN_RANGE) {
        creep.moveTo(target)
      }
    })
  }

  private stealEnergyFrom(room_name: string, target_room_name: string, x: number, y: number, opts?: {}): ActionResult {
    const options = opts || {}
    let result: ActionResult = ActionResult.DONE
    const room = Game.rooms[room_name] as Room | undefined

    const steal_energy = !room ? false : !room.storage

    if (!Memory.debug.test) {
      Memory.debug.test = []
    }

    const before_cpu = Game.cpu.getUsed()

    this.creeps.forEach((creep) => {
      if (creep.spawning) {
        return
      }
      if (creep.memory.status == CreepStatus.WAITING_FOR_RENEW) {
        result = ActionResult.IN_PROGRESS
        return
      }

      const carry = _.sum(creep.carry)

      if ((creep.room.name != room_name) && (carry < creep.carryCapacity)) {
        const dropped_energy = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
          filter: (r: Resource) => {
            return (r.resourceType == RESOURCE_ENERGY) && (r.amount > 0)
          }
        })[0]

        if (dropped_energy) {
          creep.pickup(dropped_energy)
        }
        else {
          const tombstone = creep.pos.findInRange(FIND_TOMBSTONES, 1, {
            filter: (t: Tombstone) => {
              return t.store.energy > 0
            }
          })[0]

          if (tombstone) {
            creep.withdraw(tombstone, RESOURCE_ENERGY)
          }
        }
      }

      if ((creep.memory.status != CreepStatus.HARVEST) && (creep.memory.status != CreepStatus.CHARGE)) {
        creep.memory.status = CreepStatus.HARVEST
      }

      if (creep.memory.status == CreepStatus.HARVEST) {
        if (carry == creep.carryCapacity) {
          creep.memory.status = CreepStatus.CHARGE
        }
        else {
          if (creep.moveToRoom(target_room_name) == ActionResult.IN_PROGRESS) {
            result = ActionResult.IN_PROGRESS
            return
          }
          const target_room = Game.rooms[target_room_name]
          if (!target_room) {
            return
          }

          let target: Structure | null = null
          let no_more_target = true
          const memory = creep.memory as ManualMemory

          if (memory.target_id) {
            target = Game.getObjectById(memory.target_id) as Structure | null
          }

          if (!target) {
            if (target_room.storage && steal_energy && (target_room.storage.store.energy > 0)) {
              target = target_room.storage
            }
            else if (target_room.storage && !steal_energy && (_.sum(target_room.storage.store) > 0)) {
              target = target_room.storage
            }
            else if (target_room.terminal && steal_energy && (target_room.terminal.store.energy > 0)) {
              target = target_room.terminal
            }
            else if (target_room.terminal && !steal_energy && (_.sum(target_room.terminal.store) > 0)) {
              target = target_room.terminal
            }
            else {
              target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                  // if (structure.structureType == STRUCTURE_CONTAINER) {
                  //   return structure.store.energy > 0  // to not harvest from remote harvester container
                  // }
                  // else if (
                  if (structure.structureType == STRUCTURE_LAB) {
                    return (structure.energy > 0) || (structure.mineralAmount > 0)
                  }
                  else if (
                    (structure.structureType == STRUCTURE_LINK)
                    || (structure.structureType == STRUCTURE_EXTENSION)
                    || (structure.structureType == STRUCTURE_SPAWN)
                    || (structure.structureType == STRUCTURE_TOWER)
                  ) {
                    return structure.energy > 0
                  }
                  return false
                }
              })

              if (!target) {
                no_more_target = true
              }
            }
          }

          if (!target) {
            if (!no_more_target) {
              return
            }
            (creep.memory as ManualMemory).target_id = undefined
            creep.say(`NO TGT`)
            if (carry > 0) {
              creep.memory.status = CreepStatus.CHARGE
              return
            }
            return
          }

          let withdraw_result: ScreepsReturnCode

          if ('store' in target) {
            withdraw_result = creep.withdrawResources(target)
          }
          else if (target.structureType == STRUCTURE_LAB) {
            const lab = target as StructureLab
            if (lab.mineralType && (lab.mineralAmount > 0)) {
              withdraw_result = creep.withdraw(target, lab.mineralType)
            }
            else {
              withdraw_result = creep.withdraw(target, RESOURCE_ENERGY)
            }
          }
          else {
            withdraw_result = creep.withdraw(target, RESOURCE_ENERGY)
          }

          if (withdraw_result == ERR_NOT_IN_RANGE) {
            creep.moveTo(target)
            return
          }
          else if (withdraw_result != OK) {
            creep.say(`E${withdraw_result}`)
          }
          else {
            (creep.memory as ManualMemory).target_id = undefined
          }
        }
      }

      if (creep.memory.status == CreepStatus.CHARGE) {
        (creep.memory as ManualMemory).target_id = undefined

        if (carry == 0) {
          creep.memory.status = CreepStatus.HARVEST
          result = ActionResult.IN_PROGRESS
          return
        }

        if (creep.moveToRoom(room_name) == ActionResult.IN_PROGRESS) {
          result = ActionResult.IN_PROGRESS
          return
        }

        if (creep.carry.energy > 0) {
          const charge_target = creep.find_charge_target()
          if (charge_target) {
            if (creep.transfer(charge_target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
              creep.moveTo(charge_target)
            }
            result = ActionResult.IN_PROGRESS
            return
          }
        }

        if (creep.room.controller && creep.room.controller.my && creep.room.storage) {
          const transfer_result = creep.transferResources(creep.room.storage)
          if (transfer_result == ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.storage)
          }
          else if (transfer_result != OK) {
            creep.say(`E${transfer_result}`)
          }
          result = ActionResult.IN_PROGRESS
          return
        }

        creep.moveTo(x, y)
        if ((creep.pos.x == x) && (creep.pos.y == y)) {
          creep.drop(RESOURCE_ENERGY)
          creep.memory.status = CreepStatus.HARVEST
          result = ActionResult.IN_PROGRESS
          return
        }
      }
    })

    const after_cpu = Game.cpu.getUsed()
    const cpu_usage = Math.ceil((after_cpu - before_cpu) * 1000) / 1000
    const measurement = 20

    if (Memory.debug.test.length >= measurement) {
      Memory.debug.test.shift()
      // console.log(`ManualSquad cpu usage: ${_.sum(Memory.debug.test) / measurement}, ${Memory.debug.test}`)
    }

    Memory.debug.test.push(cpu_usage)

    return result
  }

  private dismantle(target_room_name: string, include_wall?: boolean): ActionResult {
    const room = Game.rooms[target_room_name]
    if (room && room.controller && room.controller.my) {
      const message = `ManualSquad.dismantle target room ${target_room_name} has my controller, are you sure? ${this.name}`
      console.log(message)
      Game.notify(message)
      return ActionResult.DONE
    }

    let result_sum: ActionResult = ActionResult.DONE

    this.creeps.forEach((creep) => {
      const result = creep.dismantleObjects(target_room_name, {include_wall})

      if (result == ActionResult.IN_PROGRESS) {
        result_sum = ActionResult.IN_PROGRESS
      }
    });
    return result_sum
  }
}

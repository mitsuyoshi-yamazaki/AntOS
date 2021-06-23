import { UID } from "../../utility"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "_old/creep"

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

enum ManualSquadTask {
  RESERVE   = 'reserve',   // target_room_names
  STEAL     = 'steal',     // target_room_name, creeps_max, need observing // ONLY works for terminal
  DISMANTLE = 'dismantle', // target_room_name, target_ids
  SCOUT     = 'scout',     // target_room_names
}

interface ManualSquadMemory extends SquadMemory {
  creeps_max?: number
  target_room_name?: string
  target_room_names?: string[]
  target_ids?: string[]
  target_index?: number
  task?: string
  message?: string
  sign?: string
}

type MineralContainer = StructureTerminal | StructureStorage | StructureContainer
type MineralStore = MineralContainer | StructurePowerSpawn

export class ManualSquad extends Squad {
  private target_id?: string
  private desc?: string
  private spawning = false

  constructor(readonly name: string, readonly base_room: Room) {
    super(name, base_room)
  }

  public get type(): SquadType {
    return SquadType.MANUAL
  }

  public get spawnPriority(): SpawnPriority {
    const squad_memory = Memory.squads[this.name] as ManualSquadMemory

    if (squad_memory.stop_spawming) {
      return SpawnPriority.NONE
    }

    if (squad_memory.task) {
      switch (squad_memory.task) {
        case ManualSquadTask.RESERVE: {
          if (!squad_memory.target_room_names || (squad_memory.target_room_names.length == 0)) {
            return SpawnPriority.NONE
          }
          return this.creeps.size < squad_memory.target_room_names.length ? SpawnPriority.LOW : SpawnPriority.NONE
        }

        case ManualSquadTask.SCOUT: {
          if (!squad_memory.target_room_names || (squad_memory.target_room_names.length == 0)) {
            return SpawnPriority.NONE
          }
          return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
        }

        case ManualSquadTask.DISMANTLE: {
          if (!squad_memory.target_room_name || !squad_memory.target_ids || (squad_memory.target_ids.length == 0)) {
            return SpawnPriority.NONE
          }
          return this.creeps.size < 1 ? SpawnPriority.LOW : SpawnPriority.NONE
        }

        case ManualSquadTask.STEAL: {
          const squad_memory = Memory.squads[this.name] as ManualSquadMemory
          if (!squad_memory || !squad_memory.target_room_name) {
            return SpawnPriority.NONE
          }

          const target_room_name = squad_memory.target_room_name
          const target_room = Game.rooms[target_room_name]
          if (!target_room) {
            return SpawnPriority.NONE
          }
          if (!target_room.terminal || (_.sum(target_room.terminal.store) == 0)) {
            return SpawnPriority.NONE
          }

          if (this.spawning) {
            return SpawnPriority.NONE
          }

          const is_spawning = Array.from(this.creeps.values()).filter(creep => {
            return creep.spawning
          }).length > 0

          if (is_spawning) {
            return SpawnPriority.NONE
          }

          const max = !(!squad_memory.creeps_max) ? squad_memory.creeps_max : 0

          return this.creeps.size < max ? SpawnPriority.LOW : SpawnPriority.NONE
        }

        default:
          break
      }
    }

    switch (this.base_room.name) {
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

      // Memory contents:
      // - target_room_name
      // - creeps_max (set 0 to stop spawning but run creeps)
      // - need observing
      case 'W55S13':
      case 'W53S15':
      case 'W56S7': {
        const squad_memory = Memory.squads[this.name] as ManualSquadMemory
        if (!squad_memory || !squad_memory.target_room_name) {
          return SpawnPriority.NONE
        }

        const target_room_name = squad_memory.target_room_name
        const target_room = Game.rooms[target_room_name]
        if (!target_room) {
          return SpawnPriority.NONE
        }
        if (!target_room.terminal || (_.sum(target_room.terminal.store) == 0)) {
          return SpawnPriority.NONE
        }

        if (this.spawning) {
          return SpawnPriority.NONE
        }

        const is_spawning = Array.from(this.creeps.values()).filter(creep => {
          return creep.spawning
        }).length > 0

        if (is_spawning) {
          return SpawnPriority.NONE
        }

        const max = !(!squad_memory.creeps_max) ? squad_memory.creeps_max : 0

        return this.creeps.size < max ? SpawnPriority.LOW : SpawnPriority.NONE
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
    const squad_memory = Memory.squads[this.name] as ManualSquadMemory

    if (squad_memory.task) {
      switch (squad_memory.task) {
        case ManualSquadTask.RESERVE: {
          return energy_available >= 1300
        }

        case ManualSquadTask.SCOUT: {
          return energy_available >= 50
        }

        case ManualSquadTask.DISMANTLE: {
          return energy_available >= 2000
        }

        case ManualSquadTask.STEAL: {
          return energy_available >= 1500
        }

        default:
          break
      }
    }

    switch (this.base_room.name) {
      case 'W48S6': {
        return energy_available > 2020
      }

      case 'W47S9': {
        return energy_available > 2500
      }

      case 'W45S3': {
        return energy_available > 1500
      }

      case 'W46S3': {
        return energy_available >= 850
      }

      case 'W55S13':
      case 'W53S15':
      case 'W56S7': {
        return energy_available >= 2500
      }

      default:
        return false
    }
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    const squad_memory = Memory.squads[this.name] as ManualSquadMemory

    if (squad_memory.task) {
      switch (squad_memory.task) {
        case ManualSquadTask.RESERVE: {
          this.addReserveTaskReserver(energy_available, spawn_func, squad_memory)
          return
        }

        case ManualSquadTask.SCOUT: {
          this.addGeneralCreep(spawn_func, [MOVE], CreepType.SCOUT)
          return
        }

        case ManualSquadTask.DISMANTLE: {
          const body: BodyPartConstant[] = [
            MOVE, MOVE, MOVE, MOVE, MOVE,
            MOVE, MOVE, MOVE, MOVE, MOVE,
            MOVE, MOVE, MOVE, MOVE, MOVE,
            WORK, WORK, WORK, WORK, WORK,
            WORK, WORK, WORK, WORK, WORK,
            WORK, WORK, WORK, WORK, WORK,
            WORK, WORK, WORK, WORK, WORK,
            MOVE, MOVE, MOVE, MOVE, MOVE,
          ]
          this.addGeneralCreep(spawn_func, body, CreepType.WORKER)
          return
        }

        case ManualSquadTask.STEAL: {
          const body: BodyPartConstant[] = [
            CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
            CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
            CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
          ]
          this.addGeneralCreep(spawn_func, body, CreepType.CARRIER, {let_thy_live: true})
          this.spawning = true
          return
        }

        default:
          break
      }
    }

    switch (this.base_room.name) {
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

      case 'W55S13':
      case 'W53S15':
      case 'W56S7': {
        const body: BodyPartConstant[] = [
          CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
          CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
          CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
          CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
          CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE,
        ]
        this.addGeneralCreep(spawn_func, body, CreepType.CARRIER, {let_thy_live: true})
        this.spawning = true
        return
      }

      default:
        return
    }
  }

  public run(): void {
    const squad_memory = Memory.squads[this.name] as ManualSquadMemory

    if (squad_memory.message) {
      const speak = squad_memory.message

      this.creeps.forEach(creep=>{
        creep.say(speak, true)
      })
    }

    if (squad_memory.task) {
      switch (squad_memory.task) {
        case ManualSquadTask.RESERVE: {
          this.runReserveTask(squad_memory)
          return
        }

        case ManualSquadTask.SCOUT: {
          this.runScoutTask(squad_memory)
          return
        }

        case ManualSquadTask.DISMANTLE: {
          this.runDismantleTask(squad_memory)
          return
        }

        case ManualSquadTask.STEAL: {
          this.runStealTask(squad_memory)
          return
        }

        default:
          break
      }
    }

    switch (this.base_room.name) {
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
          console.log(`ManualSquad.run no base room ${this.base_room.name}, ${this.name}`)
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

      case 'W55S13':
      case 'W53S15':
      case 'W56S7': {
        this.runStealTask(squad_memory)
      }

      case 'W54S7': {
        this.creeps.forEach((creep) => {
          creep.dismantleObjects('W54S8', {include_wall: true})

        })
        return
      }

      default:
        if (this.creeps.size > 0) {
          this.say(`NO SCR`)
          console.log(`ManualSquad.run error no script for ${this.base_room.name}`)
        }
        return
    }
  }

  public description(): string {
    const squad_memory = Memory.squads[this.name] as ManualSquadMemory

    const addition = this.creeps.size > 0 ? `, ${Array.from(this.creeps.values())[0].pos}` : ''
    const task = squad_memory && squad_memory.task ? `: ${squad_memory.task}, ` : ' '

    return `${super.description()}${task}${this.desc || addition}`
  }


  // --- Private ---
  public addReserveTaskReserver(energy_available: number, spawn_func: SpawnFunction, squad_memory: ManualSquadMemory): void {
    if (this.spawning) {
      return
    }
    this.spawning = true

    if (!squad_memory.target_room_names || (squad_memory.target_room_names.length == 0)) {
      return
    }

    const targets = ([] as string[]).concat(squad_memory.target_room_names)
    const claimings = Array.from(this.creeps.values()).map(creep=>{
      const manual_memory = creep.memory as ManualMemory
      if (manual_memory.target_id) {
        return manual_memory.target_id
      }
      return ''
    })

    const target_room_name: string | undefined = targets.filter(room_name=>{
      return claimings.indexOf(room_name) < 0
    })[0]

    if (!target_room_name) {
      console.log(`ManualSquad.addCreep error target_room_name ${this.name}`)
      return
    }

    let body: BodyPartConstant[] = [
      CLAIM, CLAIM, MOVE, MOVE,
    ]

    const name = this.generateNewName()
    const memory: ManualMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CLAIMER,
      should_notify_attack: false,
      let_thy_die: true,
      target_id: target_room_name,
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  // ---
  private runReserveTask(squad_memory: ManualSquadMemory): void {
    this.creeps.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      const creep_memory = creep.memory as ManualMemory
      if (!creep_memory || !creep_memory.target_id) {
        console.log(`ManualSquad.runReserveTask ${this.base_room.name} error no target room name ${creep.name} ${creep.pos}`)
        return
      }

      const room_name = creep_memory.target_id
      creep.claim(room_name)
    })
  }

  private runScoutTask(squad_memory: ManualSquadMemory): void {
    if (!squad_memory.target_room_names || !squad_memory.target_room_names.length) {
      this.say(`ERR`)
      console.log(`ManualSquad.runScoutTask no target room names ${this.name}`)
      return
    }

    const target_room_name = squad_memory.target_room_names[0]  // todo: rotate targets

    this.creeps.forEach(creep=> {
      if (creep.spawning) {
        return
      }

      if (creep.moveToRoom(target_room_name) == ActionResult.IN_PROGRESS) {
        return
      }

      const controller = creep.room.controller

      if (squad_memory.sign && controller && controller.sign && (controller.sign.username != Game.user.name)) {
        if (creep.pos.isNearTo(controller)) {
          if (creep.signController(controller, squad_memory.sign) == OK) {
            const x = (creep.pos.x - controller.pos.x) + creep.pos.x
            const y = (creep.pos.y - controller.pos.y) + creep.pos.y

            creep.moveTo(new RoomPosition(x, y, creep.room.name))
          }
        }
        else {
          creep.moveTo(controller)
        }
      }
    })
  }

  private runDismantleTask(squad_memory: ManualSquadMemory): void {
    if (!squad_memory.target_room_name || !squad_memory.target_ids) {
      this.say(`ERR`)
      return
    }

    const target_room_name = squad_memory.target_room_name
    const target_room = Game.rooms[target_room_name]

    const target_ids = squad_memory.target_ids
    let target: Structure | undefined

    if (target_room && target_ids) {
      for (const id of target_ids) {
        target = Game.getObjectById(id) as Structure | undefined

        if (target) {
          break
        }

        const index = target_ids.indexOf(id)
        if (index >= 0) {
          target_ids.splice(index, 1)
        }
      }
    }

    this.creeps.forEach(creep=> {
      if (creep.spawning) {
        return
      }

      if (creep.moveToRoom(target_room_name) == ActionResult.IN_PROGRESS) {
        return
      }

      if (!target) {
        creep.say(`DONE`)
        return
      }

      if (creep.pos.isNearTo(target)) {
        creep.dismantle(target)
      }
      else {
        creep.moveTo(target)
      }
    })
  }

  private runStealTask(squad_memory: ManualSquadMemory): void {
    if (!squad_memory || !squad_memory.target_room_name) {
      this.say(`ERR`)
      return
    }

    const target_room_name = squad_memory.target_room_name
    const target_room = Game.rooms[target_room_name]

    if (!this.base_room.storage) {
      this.say(`ERR`)

      Game.notify(`NO TERMINAL in ${this.base_room.name}`)
      return
    }

    const max = !(!squad_memory.creeps_max) ? squad_memory.creeps_max : 0
    const should_work = (max > 0)

    const destination = this.base_room.storage

    this.creeps.forEach((creep) => {
      if (creep.spawning) {
        return
      }
      creep.memory.let_thy_die = false

      const carry = _.sum(creep.carry)

      if (carry == 0) {
        if (creep.pos.roomName == this.base_room.name) {
          const needs_renew = ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) || (((creep.ticksToLive || 0) < 1300)))// !creep.memory.let_thy_die && ((creep.memory.status == CreepStatus.WAITING_FOR_RENEW) || ((creep.ticksToLive || 0) < 300))

          if (needs_renew) {
            if ((creep.ticksToLive || 0) > 1400) {
              creep.memory.status = CreepStatus.NONE
            }
            else {
              if ((creep.room.spawns.length > 0)) {
                creep.goToRenew(creep.room.spawns[2] || creep.room.spawns[0])
                return
              }
              else if (creep.memory.status == CreepStatus.WAITING_FOR_RENEW) {
                creep.memory.status = CreepStatus.NONE
              }
            }

          }
        }

        if (creep.moveToRoom(target_room_name) == ActionResult.IN_PROGRESS) {
          return
        }

        if (target_room && target_room.terminal) {
          if (creep.pos.isNearTo(target_room.terminal)) {
            if (should_work) {
              creep.withdrawResources(target_room.terminal, {exclude: [ RESOURCE_ENERGY ]})
            }
          }
          else {
            creep.moveTo(target_room.terminal)
          }
        }
        else {
          console.log(`ManualSquad.run ${this.base_room.name} no target`)
          creep.say(`NO TGT`)
        }
      }
      else {
        if (creep.moveToRoom(this.base_room.name) == ActionResult.IN_PROGRESS) {
          return
        }

        if (creep.pos.isNearTo(destination)) {
          creep.transferResources(destination)
        }
        else {
          creep.moveTo(destination)
        }
      }
    })
    return
  }

  // ---
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

        creep.moveTo(new RoomPosition(x, y, creep.room.name))
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

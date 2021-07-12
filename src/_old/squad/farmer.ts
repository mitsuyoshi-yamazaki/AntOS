import { UID, room_link } from "../../utility"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction } from "./squad"
import { CreepStatus, ActionResult, CreepType } from "_old/creep"
import { runTowers } from "../tower";
import { ErrorMapper } from "../../error_mapper/ErrorMapper";
import { isV4CreepMemory, V4CreepMemory } from "prototype/creep";

interface FarmerUpgraderMemory extends V4CreepMemory {
  // pos: {x: number, y: number}
}

export interface FarmerSquadMemory extends SquadMemory {
  room_name: string,
  rcl: number,
  spawn_id: string | null,
  lab_id: string | null,
  second_lab_id?: string,
  storage_position: {x:number, y:number}
  positions: {x:number, y:number}[]
  avoid_positions: {x:number, y:number}[]
  charger_position: {x:number, y:number}
  renew_position: {x:number, y:number}
}

export class FarmerSquad extends Squad {
  private upgraders: {all: Creep[], sorted: Creep[], renew: Creep | null} = {all:[], sorted:[], renew: null}
  private carriers: Creep[] = []
  private builders: Creep[] = []
  private chargers: Creep[] = []

  private storage_position: {x:number, y:number}
  private positions: {x:number, y:number}[]
  private charger_position: {x:number, y:number}
  private renew_position: {x:number, y:number}

  private upgrader_max: number
  private next_creep: CreepType | undefined
  private stop_upgrader_spawn = false

  private spawn: StructureSpawn | undefined
  private lab: StructureLab | undefined
  private towers: StructureTower[] = []

  private boost_resource_type: ResourceConstant = RESOURCE_CATALYZED_GHODIUM_ACID

  constructor(readonly name: string, readonly base_room: Room, readonly room_name: string) {
    super(name, base_room)

    let error_message: string | null = null

    const squad_memory = Memory.squads[this.name] as FarmerSquadMemory
    if (squad_memory) {
      if (squad_memory.spawn_id) {
        this.spawn = Game.getObjectById(squad_memory.spawn_id) as StructureSpawn | undefined
      }
      if (squad_memory.lab_id) {
        this.lab = Game.getObjectById(squad_memory.lab_id) as StructureLab | undefined
      }

      if (squad_memory.storage_position) {
        this.storage_position = squad_memory.storage_position
      }
      else {
        this.storage_position = {x:25, y:25}
        error_message = `[ERROR] FarmerSquad ${this.name} has no storage_position`
      }

      if (squad_memory.positions) {
        this.positions = squad_memory.positions
      }
      else {
        this.positions = []
        error_message = `[ERROR] FarmerSquad ${this.name} has no position`
      }

      if (squad_memory.charger_position) {
        this.charger_position = squad_memory.charger_position
      }
      else {
        this.charger_position = {x:25, y:25}
        error_message = `[ERROR] FarmerSquad ${this.name} has no charger_position`
      }

      if (squad_memory.renew_position) {
        this.renew_position = squad_memory.renew_position
      }
      else {
        this.renew_position = {x:25, y:25}
        error_message = `[ERROR] FarmerSquad ${this.name} has no renew_position`
      }
    }
    else {
      error_message = `[ERROR] FarmerSquad ${this.name} has no memory`
      this.storage_position = {x:25, y:25}
      this.positions = []
      this.charger_position = {x:25, y:25}
      this.renew_position = {x:25, y:25}
    }

    if (error_message && ((Game.time % 43) == 5)) {
      console.log(error_message)
      Game.notify(error_message)
    }

    this.creeps.forEach((creep) => {
      if (!isV4CreepMemory(creep.memory)) {
        return
      }

      switch (creep.memory.type) {
        case CreepType.UPGRADER:
          this.upgraders.all.push(creep)
          break

        case CreepType.WORKER:
          this.builders.push(creep)
          break

        case CreepType.CARRIER:
          this.carriers.push(creep)
          break

        case CreepType.CHARGER:
          this.chargers.push(creep)
          break

        default:
          console.log(`FarmerSquad unexpected creep type ${creep.memory.type}, ${this.name}, ${creep.pos}`)
          break
      }
    })

    this.upgraders.all = this.upgraders.all.sort((lhs, rhs) => {
      if (!isV4CreepMemory(lhs.memory) || !isV4CreepMemory(rhs.memory)) {
        return 0
      }

      if ((lhs.memory.status == CreepStatus.WAITING_FOR_RENEW) || rhs.spawning) {
        return -1
      }
      if ((rhs.memory.status == CreepStatus.WAITING_FOR_RENEW) || lhs.spawning) {
        return 1
      }

      const lhs_ticks_to_live = lhs.ticksToLive || 1500
      const rhs_ticks_to_live = rhs.ticksToLive || 1500

      if (lhs_ticks_to_live > rhs_ticks_to_live) return 1
      if (lhs_ticks_to_live < rhs_ticks_to_live) return -1
      return 0
    })

    if (this.upgraders.all.length > 0) {
      this.upgraders.renew = this.upgraders.all[0]
      this.upgraders.sorted = this.upgraders.all.slice(1, this.upgraders.all.length)

      // console.log(`HGOE renew ${this.upgraders.renew}, sorted: ${this.upgraders.sorted.map(c=>c.name)}, all: ${this.upgraders.all.map(c=>c.name)}`)
    }

    const positions_count = this.positions.length + 1
    this.upgrader_max = positions_count

    const destination_room = Game.rooms[this.room_name]
    const rcl = (destination_room && destination_room.controller) ? destination_room.controller.level : 0

    if (destination_room && destination_room.storage) {
      const energy_max = Math.floor(destination_room.storage.store.energy / 100000)
      this.upgrader_max = Math.min(positions_count, Math.max(1, energy_max))
    }
    else if (rcl < 6) {
      this.upgrader_max = 2
    }

    if ((Game.time % 193) == 1) {
      const renew_upgraders = this.upgraders.sorted.filter((creep) => {
        if (!isV4CreepMemory(creep.memory)) {
          return false
        }

        return !creep.memory.let_thy_die
      })

      console.log(`FarmerSquad upgrader_max: ${this.upgrader_max}, renew: ${renew_upgraders.length}, ${this.name}`)

      if ((renew_upgraders.length > this.upgrader_max) && renew_upgraders[0] && isV4CreepMemory(renew_upgraders[0].memory)) {
        renew_upgraders[0].memory.let_thy_die = true
        console.log(`FarmerSquad let_thy_die: ${renew_upgraders[0].name}, ${this.name}`)
      }
    }

    this.next_creep = this.nextCreep()

    const empire_memory = Memory.empires[Game.user.name]
    if (empire_memory && empire_memory.farm && empire_memory.farm.boost_compound) {
      this.boost_resource_type = empire_memory.farm.boost_compound as ResourceConstant
    }

    if (destination_room) {
      const index = 3
      this.showDescription(destination_room, index)
    }
  }

  private nextCreep(): CreepType | undefined {
    let debug = false

    const destination_room = Game.rooms[this.room_name] as Room | undefined
    if (!destination_room || !destination_room.controller || !destination_room.controller.my) {
      if (debug) {
        console.log(`FarmerSquad.nextCreep no destination room ${destination_room}, ${this.name}`)
      }
      return undefined
    }

    if (destination_room.controller && (destination_room.controller.level == 8)) {
      if (debug) {
        console.log(`FarmerSquad.nextCreep RCL8 ${this.name}`)
      }
      return undefined
    }

    // Charger
    if (this.chargers.length == 0) {
      return CreepType.CHARGER
    }

    const rcl = destination_room.controller.level

    // Upgrader
    let need_carriers = false  // @todo: if storage is empty

    if (!destination_room.storage) {
      need_carriers = true
    }
    else if (rcl < 4) {
      if (destination_room.storage.store.energy < 10000) {
        need_carriers = true
      }
    }
    else if (rcl < 6) {
      if (rcl == 4) {
        need_carriers = true
      }
      else if (rcl == 5) {
        const remaining_progress = destination_room.controller.progressTotal - destination_room.controller.progress

        if (!destination_room.storage || (destination_room.storage.store.energy < (remaining_progress + 10000))) {
          need_carriers = true
        }
      }
    }
    else if (!destination_room.terminal) {
      need_carriers = true
    }

    if (this.upgraders.all.length < this.upgrader_max) {
      if (need_carriers && (this.carriers.length == 0)) { // @todo: if rcl < 4 && storage is empty
        if (debug) {
          console.log(`FarmerSquad.nextCreep no carriers ${this.name}`)
        }
        return CreepType.CARRIER
      }

      const oldest_upgrader = this.upgraders.renew
      if (oldest_upgrader && ((oldest_upgrader.spawning) || (isV4CreepMemory(oldest_upgrader.memory) && (oldest_upgrader.memory.status == CreepStatus.WAITING_FOR_RENEW)) || ((oldest_upgrader.ticksToLive || 0) < 160))) {
        this.stop_upgrader_spawn = true
      }
      else {
        if (debug) {
          console.log(`FarmerSquad.nextCreep upgrader ${this.name}`)
        }
        return CreepType.UPGRADER
      }
    }

    // Carrier
    if (!this.base_room.storage) {
      if (debug) {
        console.log(`FarmerSquad.nextCreep no base room storage ${this.name}`)
      }
      return undefined
    }
    else if (this.base_room.storage.store.energy < 150000) {
      if (debug) {
        console.log(`FarmerSquad.nextCreep lack of energy ${this.name}`)
      }
      return undefined
    }

    const carrier_max = need_carriers ? 14 : 0
    if (destination_room && destination_room.controller && (destination_room.controller.level < 6) && (this.carriers.length < carrier_max)) {
      if (debug) {
        console.log(`FarmerSquad.nextCreep carrier ${this.name}`)
      }
      return CreepType.CARRIER
    }

    if (debug) {
      console.log(`FarmerSquad.nextCreep none ${this.name}`)
    }
    return undefined
  }

  public get type(): SquadType {
    return SquadType.FARMER
  }

  public static generateNewName(): string {
    return UID(SquadType.FARMER)
  }

  public generateNewName(): string {
    return FarmerSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    const squad_memory = Memory.squads[this.name]
    if (squad_memory.stop_spawming) {
      return SpawnPriority.NONE
    }

    switch (this.next_creep) {
      case CreepType.UPGRADER:
        if (this.stop_upgrader_spawn) {
          return SpawnPriority.NONE
        }

        const is_spawning = Array.from(this.creeps.values()).filter((creep) => creep.spawning).length > 0
        if (is_spawning) {
          this.stop_upgrader_spawn = true
          return SpawnPriority.NONE
        }

        // const youngest_upgrader = this.upgraders.sorted[this.upgraders.sorted.length - 1]
        // if (youngest_upgrader && ((youngest_upgrader.ticksToLive || 1500) > 1340)) {
        //   this.stop_upgrader_spawn = true
        //   return SpawnPriority.NONE
        // }
        return SpawnPriority.LOW

      case CreepType.WORKER:
        return SpawnPriority.NONE // @fixme:

      case CreepType.CARRIER:
        return SpawnPriority.LOW

      case CreepType.CHARGER:
        return SpawnPriority.HIGH

      default:
        return SpawnPriority.NONE
    }
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    let max: number | undefined
    let energy_unit: number | undefined

    switch (this.next_creep) {
      case CreepType.UPGRADER:
        return this.hasEnoughEnergyForUpgrader(energy_available, capacity, 4300)

      case CreepType.WORKER:
        energy_unit = 200
        max = energy_unit * 8
        break

      case CreepType.CARRIER:
        energy_unit = 150
        max = (energy_unit * 12)
        break

      case CreepType.CHARGER:
        return energy_available >= 850

      default:
        console.log(`FarmerSquad.hasEnoughEnergy unexpected creep type ${this.next_creep}, ${this.name}`)
        return false
    }

    if (!max || !energy_unit) {
      console.log(`FarmerSquad.hasEnoughEnergy unexpected error ${this.next_creep}, ${max}, ${energy_unit}, ${energy_available}, ${this.name}`)
      return false
    }

    capacity = Math.min((capacity - 50), max)

    const energy_needed = (Math.floor(capacity / energy_unit) * energy_unit)
    return energy_available >= energy_needed
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    switch (this.next_creep) {
      case CreepType.UPGRADER: {
        this.addFarmer(energy_available, spawn_func)
        return
      }

      case CreepType.WORKER:
        return // @todo:

      case CreepType.CARRIER:
        this.addCarrier(energy_available, spawn_func)
        return

      case CreepType.CHARGER:
        const body: BodyPartConstant[] = [
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY, CARRY, CARRY, CARRY, CARRY,
          CARRY,
          MOVE
        ]
        this.addGeneralCreep(spawn_func, body, CreepType.CHARGER)
        return

      default:
        return
    }
  }

  public run(): void {
    const room = Game.rooms[this.room_name] as Room | undefined
    this.towers = (!room || !room.owned_structures) ? [] : (room.owned_structures.get(STRUCTURE_TOWER) as StructureTower[]) || []

    this.runUpgrader()
    this.runCharger()

    ErrorMapper.wrapLoop(() => {
      this.runCarrier()
    }, `${this.name}.runCarrier`)()

    if (room) {
      runTowers(this.towers, room, {wall_max_hits: 3000000})

      if ((Game.time % 101) == 0) {
        room.place_construction_sites()
      }
    }

    const squad_memory = Memory.squads[this.name] as FarmerSquadMemory

    if (((Game.time % 449) == 1) && room && (this.creeps.size > 0) && Memory.squads[this.name]) {
      if (!this.spawn) {
        const spawn = room.find(FIND_MY_SPAWNS)[0]

        if (spawn) {
          squad_memory.spawn_id = spawn.id
        }
      }

      if (!this.lab) {
        const lab = room.find(FIND_MY_STRUCTURES, {
          filter: (structure) => {
            return structure.structureType == STRUCTURE_LAB
          }
        })[0]

        if (lab) {
          squad_memory.lab_id = lab.id
        }
      }
    }
  }

  public description(): string {
    const number_of_creeps = `U${this.upgraders.all.length}CRY${this.carriers.length}CHG${this.chargers.length}`
    return `${super.description()}, ${this.next_creep}, ${number_of_creeps}`
  }

  // ---
  private addFarmer(energy_available: number, spawn_func: SpawnFunction): void {
    if (this.stop_upgrader_spawn) {
      return
    }

    const body: BodyPartConstant[] = [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK,
      CARRY, CARRY,
    ]

    const memory: FarmerUpgraderMemory = {
      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.UPGRADER,
      should_notify_attack: false,
      let_thy_die: false,
    }

    const result = this.addGeneralCreep(spawn_func, body, CreepType.UPGRADER, {memory})

    if (result == OK) {
      this.stop_upgrader_spawn = true
    }
  }

  private addCarrier(energy_available: number, spawn_func: SpawnFunction): void {
    const body_unit: BodyPartConstant[] = [
      CARRY, CARRY, MOVE
    ]
    const energy_unit = 150

    const name = this.generateNewName()
    let body: BodyPartConstant[] = []
    const memory: V4CreepMemory = {


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
  }

  // ---
  private runUpgrader(): void {
    const room = Game.rooms[this.room_name]
    if (!room || !room.controller || !room.controller.my) {
      const message = `FarmerSquad.runUpgrader unexpectedly null room ${room}, ${this.room_name}, ${this.name}`
      console.log(message)
      Game.notify(message)
      return
    }
    const controller = room.controller

    this.upgraders.all.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      if (room.storage && (room.storage.store.energy > 0)) {
        creep.withdraw(room.storage, RESOURCE_ENERGY)
      }
      // else if (this.container && (this.container.store.energy > 0)) {
      //   creep.withdraw(this.container, RESOURCE_ENERGY)
      // }
      else {
        // test
        const drop = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
          filter: (d: Resource) => {
            return d.resourceType == RESOURCE_ENERGY
          }
        })[0]

        if (drop) {
          creep.pickup(drop)
        }
      }

      // if (!creep.boosted()) {
      if (creep.room.construction_sites && (creep.room.construction_sites.length > 0)) {
        const construction_site = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 3)[0]
        if (construction_site) {
          creep.build(construction_site)  // @fixme: when build storage
          return
        }
      }

      creep.upgradeController(controller)
      // creep.repair(Game.getObjectById('5b7bd895e11abe3f9e43e116') as StructureRampart)
    })

    if (this.upgraders.renew && isV4CreepMemory(this.upgraders.renew.memory)) {
      const creep = this.upgraders.renew
      const creepMemory = this.upgraders.renew.memory
      const pos = new RoomPosition(this.renew_position.x, this.renew_position.y, this.room_name)

      if ((creep.room.name != this.room_name) || (creep.pos.x != pos.x) || (creep.pos.y != pos.y)) {
        const result = creep.moveTo(pos, {maxRooms:2, reusePath: 10})
        if ((result != OK) && (result != ERR_TIRED)) {
          creep.say(`E${result}`)
        }
      }

      const dying_tick = 3
      const dying = ((creep.ticksToLive || 1500) <= dying_tick)
      const needs_renew = !creepMemory.let_thy_die && ((creepMemory.status == CreepStatus.WAITING_FOR_RENEW) || dying)

      if (needs_renew) {
        if (((creep.ticksToLive || 1500) == dying_tick) && creep.boosted()) {
          let lab: StructureLab | undefined

          if (this.lab && (this.lab.cooldown == 0)) {
            lab = this.lab
          }
          else {
            const squad_memory = Memory.squads[this.name] as FarmerSquadMemory

            if (squad_memory && squad_memory.second_lab_id) {
              let second_lab = Game.getObjectById(squad_memory.second_lab_id) as StructureLab | undefined

              if (second_lab && (second_lab.cooldown == 0)) {
                lab = second_lab
              }
            }
          }

          if (lab) {
            const result = (lab as any as {unboostCreep: (c: Creep) => ScreepsReturnCode}).unboostCreep(creep) // @fixme:

            console.log(`FarmerSquad.runUpgrader unboost creep: ${result}, ${this.name}`)
          }
        }
        else if ((creep.ticksToLive || 1500) > 1490) {
          if (!creep.boosted() && this.lab && room.storage && room.controller) {
            console.log(`FarmerSquad.runUpgrader boostCreep ${this.room_name}, ${creep.name}, ${this.name}`)

            let should_boost = true

            if ((this.lab.mineralType != this.boost_resource_type) || (this.lab.mineralAmount < 30)) {
              should_boost = false
            }
            else if (room.storage.store.energy < 150000) {
              should_boost = false
            }
            else if (room.controller.level == 8) {
              should_boost = false
            }
            else if ((room.controller.level == 7) && ((room.controller.progressTotal - room.controller.progress) < 800000)) {
              should_boost = false
            }

            if (should_boost) {
              const result = this.lab.boostCreep(creep)
              if (result != OK) {
                console.log(`FarmerSquad.runUpgrader boostCreep failed with ${result}, ${this.base_room.name}, ${creep.name}, ${this.name}`)
              }
            }
            else {
              console.log(`FarmerSquad.runUpgrader boostCreep wrong environment ${creep.boosted()}, ${this.lab}, energy: ${room.storage.store.energy}`)
            }
          }
          creep.say(`RENEWED`)
          creepMemory.status = CreepStatus.NONE
        }
        else if (this.spawn) {
          creepMemory.status = CreepStatus.WAITING_FOR_RENEW
          this.spawn.renewCreep(creep)
          creep.transfer(this.spawn, RESOURCE_ENERGY)
        }
      }
    }

    _.zip((this.upgraders.sorted as any[]), (this.positions as any[])).forEach((value) => {
      const creep = (value as [Creep | null, {x:number, y:number} | null])[0]
      if (!creep) {
        return
      }
      if (creep.spawning) {
        return
      }

      const position = (value as [Creep | null, {x:number, y:number} | null])[1]
      if (!position) {
        console.log(`FarmerSquad.run unexpectedly upgrader(${this.upgraders.sorted.length}):position(${this.positions.length}) size mismatch ${this.name}`)
        return
      }

      const pos = new RoomPosition(position.x, position.y, this.room_name)

      if ((creep.room.name != this.room_name) || (creep.pos.x != pos.x) || (creep.pos.y != pos.y)) {
        const result = creep.moveTo(pos)
        if ((result != OK) && (result != ERR_TIRED)) {
          creep.say(`E${result}`)
        }
      }
    })
  }

  private runCarrier(): void {
    if (!this.base_room.storage) {
      this.say(`ERR`)
      return
    }
    const storage = this.base_room.storage

    const pos = new RoomPosition(this.storage_position.x, this.storage_position.y, this.room_name)

    this.carriers.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      if (['W48S5', 'W49S5'].indexOf(creep.room.name) >= 0) {
        console.log(`ERR FarmerSquad.runCarrier ${creep.pos}`)
      }

      if (creep.carry.energy == 0) {
        if (creep.pos.getRangeTo(pos) > 2) {
          const drop = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
            filter: (resource: Resource) => {
              return resource.resourceType == RESOURCE_ENERGY
            }
          })[0]

          if (drop) {
            creep.pickup(drop)
          }
        }

        if (creep.room.is_keeperroom) {
          if (creep.moveToRoom(this.base_room.name) == ActionResult.IN_PROGRESS) {
            return
          }
        }

        if (creep.pos.isNearTo(storage)) {
          creep.withdraw(storage, RESOURCE_ENERGY)
        }
        else {
          moveCarrier(this.room_name, creep, storage.pos)
          // creep.moveTo(storage, {maxRooms:2, reusePath: 10})
        }
      }
      else {
        const destination_room = Game.rooms[this.room_name] as Room | undefined
        if ((creep.room.name != this.room_name) || !destination_room) {
          if (moveCarrier(this.room_name, creep, null) == ActionResult.IN_PROGRESS) {
            creep.moveToRoom(this.room_name)
          }
          return
        }

        if (destination_room.storage && destination_room.controller && (destination_room.controller.level >= 4)) {
          if (creep.pos.isNearTo(destination_room.storage)) {
            creep.transfer(destination_room.storage, RESOURCE_ENERGY)
          }
          else {
            moveCarrier(this.room_name, creep, destination_room.storage.pos)
            // creep.moveTo(destination_room.storage, {maxRooms:2, reusePath: 10})
          }
        }
        else {
          if ((creep.pos.x != pos.x) || (creep.pos.y != pos.y)) {
            creep.moveTo(pos, {maxRooms:2, reusePath: 10})
          }
          else {
            creep.drop(RESOURCE_ENERGY)
          }
        }
      }
    })
  }

  private runCharger(): void {
    const room = Game.rooms[this.room_name]
    if (!room) {
      this.say(`NO ROOM`)
      return
    }

    const rcl = room.controller ? room.controller.level : 0

    this.chargers.forEach((creep) => {
      const pos = new RoomPosition(this.charger_position.x, this.charger_position.y, this.room_name)

      if ((creep.room.name != pos.roomName) || (creep.pos.x != pos.x) || (creep.pos.y != pos.y)) {
        creep.moveTo(pos, {maxRooms:2, reusePath:10})
        return
      }

      if (((creep.ticksToLive || 1500) < 1400) && this.spawn && !this.spawn.spawning) {
        this.spawn.renewCreep(creep)
      }

      const carry = creep.store.getUsedCapacity()
      if (carry == 0) {
        const drop = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0]

        if (drop) {
          creep.pickup(drop)
          return
        }

        if ((rcl >= 6) && room.terminal && (room.terminal.store.getUsedCapacity() > (room.terminal.store.getCapacity() * 0.9))) {
          creep.withdraw(room.terminal, RESOURCE_ENERGY)
          return
        }

        if (room.terminal && (rcl >= 6) && this.lab) {
          if (this.lab.mineralType && (this.lab.mineralType != this.boost_resource_type)) {
            creep.withdraw(this.lab, this.lab.mineralType)
            return
          }

          if ((this.lab.mineralAmount < this.lab.mineralCapacity) && ((room.terminal.store[this.boost_resource_type] || 0) > 0)) {
            creep.withdraw(room.terminal, this.boost_resource_type)
            return
          }
        }

        if (((Game.time % 229) == 3) && room.terminal && (rcl >= 6) && room.storage) {
          if ((room.storage.store.getUsedCapacity() - room.storage.store.energy) > 0) {
            creep.withdrawResources(room.storage, {exclude: ['energy']})
            return
          }
        }

        if (room.terminal && (room.terminal.store.energy > 0)) {
          creep.withdraw(room.terminal, RESOURCE_ENERGY)
          return
        }

        if (room.storage && (room.storage.store.energy > 0)) {
          creep.withdraw(room.storage, RESOURCE_ENERGY)
          return
        }


        creep.say(`NO ENGY`)
      }
      else {
        if ((rcl >= 6) && room.terminal && (room.terminal.store.getFreeCapacity() <= 0) && room.storage) {
          creep.transferResources(room.storage)
          return
        }

        if ((carry - creep.carry.energy) > 0) {
          if (((creep.carry[this.boost_resource_type] || 0) > 0) && this.lab && (this.lab.mineralAmount < this.lab.mineralCapacity) && (!this.lab.mineralType || (this.lab.mineralType == this.boost_resource_type))) {
            creep.transfer(this.lab, this.boost_resource_type)
          }
          else {
            if (room.terminal && (rcl >= 6)) {
              creep.transferResources(room.terminal)
              return
            }

            if (room.storage) {
              creep.transferResources(room.storage)
              return
            }

            creep.say(`NO STR`)
          }
        }

        let charge_targets: (StructureSpawn | StructureLab | StructureTower)[] = []

        if (this.spawn) {
          charge_targets.push(this.spawn)
        }
        if (this.lab) {
          charge_targets.push(this.lab)
        }
        if (this.towers && (this.towers.length > 0)) {
          charge_targets = charge_targets.concat(this.towers)
        }

        charge_targets = charge_targets.filter(structure => {
          if (structure.structureType == STRUCTURE_SPAWN) {
            return structure.energy < (structure.energyCapacity * 0.5)
          }
          if (structure.energy < (structure.energyCapacity * 0.8)) {
            return true
          }
          return false
        })

        const target = charge_targets[0]

        if (target) {
          // console.log(`tgt ${target}, ${target.pos}`)
          creep.transfer(target, RESOURCE_ENERGY)
          return
        }
        else {
          if (room.storage && (room.storage.store.getUsedCapacity() < (room.storage.store.getCapacity() * 0.8))) {
            // console.log(`tgt storage`)

            creep.transfer(room.storage, RESOURCE_ENERGY)
            return
          }
          else if (room.terminal && (rcl >= 6)) {
            // console.log(`tgt terminal`)

            creep.transfer(room.terminal, RESOURCE_ENERGY)
            return
          }
          // console.log(`tgt none`)

          if (room.controller && (room.controller.level >= 4)) {
            creep.say(`NO CHG`)
          }
        }
      }
    })
  }
}

type MovePaths = {[farm_room_name: string]: {[direction: string]: {[room_name: string]: {[x: number]: {[y: number]: DirectionConstant}}}}}
const carrier_paths: MovePaths = {
  W46S9: {
    withdraw: { // W46S9
      W47S9: {
        49: {
          18: BOTTOM_LEFT,
          19: LEFT,
          20: TOP_LEFT,
        },
        48: {19: TOP_LEFT},
        47: {18: TOP_LEFT},
        46: {17: TOP_LEFT},
        45: {16: TOP_LEFT},
        44: {15: TOP_LEFT},
        43: {14: TOP_LEFT},
        42: {13: TOP_LEFT},
      },
      W46S9: {
        45: {24: LEFT},
        44: {24: BOTTOM_LEFT},
        43: {25: BOTTOM_LEFT},
        42: {26: BOTTOM_LEFT},
        41: {27: BOTTOM_LEFT},
        40: {28: TOP_LEFT},
        39: {27: TOP_LEFT},
        38: {26: TOP_LEFT},
        37: {25: TOP_LEFT},
        36: {24: TOP_LEFT},
        35: {23: TOP_LEFT},
        34: {22: TOP_LEFT},
        33: {21: LEFT},
        32: {21: LEFT},
        31: {21: BOTTOM_LEFT},
        30: {22: BOTTOM_LEFT},
        29: {23: LEFT},
        28: {23: LEFT},
        27: {23: LEFT},
        26: {23: LEFT},
        25: {23: LEFT},
        24: {23: LEFT},
        23: {23: LEFT},
        22: {23: LEFT},
        21: {23: LEFT},
        20: {23: LEFT},
        19: {23: TOP_LEFT},
        18: {22: TOP_LEFT},
        17: {21: LEFT},
        16: {21: LEFT},
        15: {21: LEFT},
        14: {21: LEFT},
        13: {21: LEFT},
        12: {21: LEFT},
        11: {21: LEFT},
        10: {21: LEFT},
        9: {21: BOTTOM_LEFT},
        8: {22: BOTTOM_LEFT},
        7: {23: TOP_LEFT},
        6: {22: TOP_LEFT},
        5: {21: LEFT},
        4: {21: LEFT},
        3: {21: LEFT},
        2: {21: TOP_LEFT},
        1: {20: LEFT},
      }
    },
    charge: { // W46S9
      W47S9: {
        37: {12: BOTTOM_RIGHT},
        38: {
          11: BOTTOM_LEFT,
          13: BOTTOM_RIGHT,
        },
        39: {
          10: BOTTOM_RIGHT,
          14: BOTTOM_RIGHT,
        },
        40: {
          9: BOTTOM_RIGHT,
          11: BOTTOM_RIGHT,
          15: BOTTOM_RIGHT,
        },
        41: {
          10: BOTTOM_RIGHT,
          12: BOTTOM_RIGHT,
          16: TOP_RIGHT,
        },
        42: {
          11: BOTTOM_RIGHT,
          13: BOTTOM_RIGHT,
          15: TOP_RIGHT,
        },
        43: {
          12: BOTTOM_RIGHT,
          14: BOTTOM_RIGHT,
        },
        44: {
          13: BOTTOM_LEFT,
          15: BOTTOM_RIGHT,
        },
        45: {16: BOTTOM_RIGHT},
        46: {17: BOTTOM_RIGHT},
        47: {18: BOTTOM_RIGHT},
        48: {19: BOTTOM_RIGHT},
      },
      W46S9: {
        0: {
          19: BOTTOM_RIGHT,
          20: RIGHT,
          21: TOP_RIGHT,
        },
        1: {20: BOTTOM_RIGHT},
        2: {21: RIGHT},
        3: {21: RIGHT},
        4: {21: RIGHT},
        5: {21: BOTTOM_RIGHT},
        6: {22: BOTTOM_RIGHT},
        7: {23: TOP_RIGHT},
        8: {22: TOP_RIGHT},
        9: {21: RIGHT},
        10: {21: RIGHT},
        11: {21: RIGHT},
        12: {21: RIGHT},
        13: {21: RIGHT},
        14: {21: RIGHT},
        15: {21: RIGHT},
        16: {21: RIGHT},
        17: {21: BOTTOM_RIGHT},
        18: {22: BOTTOM_RIGHT},
        19: {23: RIGHT},
        20: {23: RIGHT},
        21: {23: RIGHT},
        22: {23: RIGHT},
        23: {23: RIGHT},
        24: {23: RIGHT},
        25: {23: RIGHT},
        26: {23: RIGHT},
        27: {23: RIGHT},
        28: {23: RIGHT},
        29: {23: TOP_RIGHT},
        30: {22: TOP_RIGHT},
        31: {21: RIGHT},
        32: {21: RIGHT},
        33: {21: RIGHT},
        34: {21: RIGHT},
        35: {21: RIGHT},
        36: {21: RIGHT},
        37: {21: RIGHT},
        38: {21: TOP_RIGHT},
        39: {20: TOP_RIGHT},
        40: {19: BOTTOM_RIGHT},
        41: {20: BOTTOM_RIGHT},
        42: {21: BOTTOM_RIGHT},
        43: {22: BOTTOM_RIGHT},
        44: {23: BOTTOM_RIGHT},
      }
    },
  }
}

function getDirection(farm_room_name: string, carry_direction: 'withdraw' | 'charge', pos: RoomPosition): DirectionConstant | null {
  const paths = carrier_paths[farm_room_name]
  if (!paths) {
    return null
  }

  const directional_paths = paths[carry_direction]
  const room = directional_paths[pos.roomName]
  if (!room) {
    return null
  }

  const x = room[pos.x]
  if (!x) {
    return null
  }

  const direction = x[pos.y]
  if ((direction == undefined) || (direction == null)) {
    return null
  }
  return direction
}

function moveCarrier(farm_room_name: string, creep: Creep, destination: RoomPosition | null): ActionResult {
  const charge_direction = (creep.carry.energy == 0) ? 'withdraw' : 'charge'
  const direction: DirectionConstant | null = getDirection(farm_room_name, charge_direction, creep.pos)
  if (direction) {
    creep.move(direction)
    return ActionResult.DONE
  }

  if (!destination) {
    return ActionResult.IN_PROGRESS
  }

  creep.say('!')
  creep.moveTo(destination, {maxRooms:2, reusePath: 10})

  return ActionResult.IN_PROGRESS
}


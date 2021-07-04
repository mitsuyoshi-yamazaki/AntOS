import { UID, room_link } from "../../utility"
import { Squad, SquadType, SquadMemory, SpawnPriority, SpawnFunction, SquadStatus } from "./squad"
import { CreepStatus, ActionResult, CreepType, CreepSearchAndDestroyOption } from "_old/creep"
import { runHarvester } from "./harvester"
import { Region } from "../region";

export type HarvesterDestination = StructureContainer | StructureTerminal | StructureStorage | StructureLink

export interface RemoteHarvesterMemory extends CreepMemory {
  source_id: string | undefined
}

export interface RemoteHarvesterSquadMemory extends SquadMemory {
  room_name: string
  sources: {[index: string]: {container_id?: string}}
  room_contains_construction_sites: string[]
  carrier_max?: number
  destination_id?: string
  need_attacker?: boolean
  defend_room_name?: string
  builder_max?: number
  attacker_spawn_ticks_before?: number
}

interface SourceInfo {
  id: string
  target: Source | Mineral | undefined
  container: StructureContainer | undefined
  harvesters: Creep[]
}

export class RemoteHarvesterSquad extends Squad {
  public is_keeper_room: boolean

  private scout: Creep | undefined
  private builders: Creep[] = []
  private harvesters: Creep[] = []
  private keeper: Creep | undefined
  private source_info = new Map<string, SourceInfo>()
  private carriers: Creep[] = []
  private attackers: Creep[] = []
  private ranged_attackers: Creep[] = []
  private need_attacker: boolean
  private is_room_attacked: boolean
  private keeper_lairs: StructureKeeperLair[] = []
  private containers: StructureContainer[] = []
  private containers_with_energy: StructureContainer[]
  private construction_sites: ConstructionSite[] | undefined

  private debug = false
  private next_creep: CreepType | undefined
  private harvester_energy_unit = 850
  private harvester_body_unit: BodyPartConstant[] = [
    MOVE, MOVE,
    CARRY, CARRY,
    WORK, WORK, WORK,
    WORK, WORK, WORK,
    MOVE,
  ]

  private avoid_cpu_use = false

  constructor(readonly name: string, readonly base_room: Room, readonly room_name: string, readonly source_ids: string[], readonly destination: HarvesterDestination, readonly capacity: number, readonly region: Region) {
    super(name, base_room)

    const room = Game.rooms[this.room_name] as Room | undefined
    const squad_memory = Memory.squads[this.name] as RemoteHarvesterSquadMemory

    this.is_keeper_room = !(!squad_memory) && !(!squad_memory.need_attacker)

    if ((['W53S15'].indexOf(this.base_room.name) >= 0) && this.base_room.controller && (this.base_room.controller.level < 6)) {
      this.harvester_energy_unit = 1000
      this.harvester_body_unit = [
        CARRY, CARRY,
        MOVE, MOVE,
        MOVE, MOVE, MOVE,
        WORK, WORK, WORK,
        WORK, WORK, WORK,
        MOVE,
      ]
    }

    if (this.harvester_energy_unit > capacity) {
      this.harvester_energy_unit = 300
      this.harvester_body_unit = [
        MOVE,
        CARRY,
        WORK, WORK,
      ]
    }

    if (room && room.storage && room.controller && room.controller.my && (room.controller.level >= 4)) {
      this.destination = room.storage
    }
    else if ((this.room_name == 'W45S9')) {
      const w46s9 = Game.rooms['W46S9']
      if (w46s9 && w46s9.storage && w46s9.controller && w46s9.controller.my && (w46s9.controller.level >= 4)) {
        this.destination = w46s9.storage
      }
    }
    else if (squad_memory.destination_id) {
      const specified_destination = Game.getObjectById(squad_memory.destination_id) as HarvesterDestination | undefined

      if (specified_destination) {
        const ok = specified_destination && (
          (specified_destination.structureType == STRUCTURE_CONTAINER)
          || (specified_destination.structureType == STRUCTURE_TERMINAL)
          || (specified_destination.structureType == STRUCTURE_STORAGE)
          || (specified_destination.structureType == STRUCTURE_LINK)
        )

        if (ok) {
          if ((specified_destination.structureType != STRUCTURE_LINK) || (specified_destination.energy == 0)) {
            this.destination = specified_destination
          }
        }
        else {
          const message = `RemoteHarvesterSquad specified destination id is wrong ${squad_memory.destination_id}, ${specified_destination}, ${this.name}, ${this.room_name}`
          console.log(message)
          Game.notify(message)
        }
      }
    }

    if (squad_memory.need_attacker && room) {
      this.keeper_lairs = room.find(FIND_STRUCTURES, {
        filter: (structure: Structure) => {
          return (structure.structureType == STRUCTURE_KEEPER_LAIR)
        }
      }) as StructureKeeperLair[]
    }

    this.source_ids.forEach((id) => {
      let container: StructureContainer | undefined
      const target = Game.getObjectById(id) as Source | Mineral | undefined

      if (squad_memory.sources[id] && squad_memory.sources[id].container_id) {
        const container_id = squad_memory.sources[id].container_id
        if (container_id) {
          container = Game.getObjectById(container_id) as StructureContainer | undefined
        }
      }

      if (container) {
        this.containers.push(container)
      }

      if (!container || (container.structureType != STRUCTURE_CONTAINER)) {
        if (target && ((Game.time % 2) == 1)) {
          container = target.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: function(structure: Structure) {
              return structure.structureType == STRUCTURE_CONTAINER
            }
          })[0] as StructureContainer | undefined

          if (container && (container.structureType == STRUCTURE_CONTAINER)) {
            (Memory.squads[this.name] as RemoteHarvesterSquadMemory).sources[id].container_id = container.id
          }
        }
        else {
          container = undefined
        }
      }

      const info: SourceInfo = {
        id,
        target,
        container,
        harvesters: [],
      }
      this.source_info.set(id, info)
    })

    let energy_threshold = 600
    if (this.room_name == 'W45S5') {
      energy_threshold = 1000
    }

    this.containers_with_energy = this.containers.filter((c) => {
      return (c.store.energy > energy_threshold)
    })


    let attacker_max_ticks = 0

    this.creeps.forEach((creep) => {
      const memory = creep.memory as RemoteHarvesterMemory

      // Log current position
      // if (this.base_room.name == 'W47N5') {
      //   if (((Game.time % 29) == 11) && ([this.room_name, this.base_room.name].indexOf(creep.room.name) < 0)) {
      //     console.log(`${this.room_name} ${creep.memory.type} ${creep.pos}`)
      //   }
      // }

      switch (creep.memory.type) {
        case CreepType.WORKER:
          this.builders.push(creep)
          break

        case CreepType.HARVESTER: {
          this.harvesters.push(creep)

          const source_id: string = memory.source_id || this.source_ids[0]  // Should have memory.source_id
          const info = this.source_info.get(source_id)
          if (!info) {
            creep.say(`NO SRC`)
            console.log(`RemoteHarvesterSquad specified source_id not exists ${this.name}, ${creep.name}, ${memory.source_id}, ${this.source_ids}`)
            return
          }
          info.harvesters.push(creep)
          break
        }

        case CreepType.CARRIER:
          this.carriers.push(creep)
          break

        case CreepType.CONTROLLER_KEEPER:
          this.keeper = creep
          break

        case CreepType.SCOUT:
          this.scout = creep
          break

        case CreepType.ATTACKER: {
          this.attackers.push(creep)
          const ticks = creep.spawning ? 1500 : (creep.ticksToLive || 0)

          if (ticks > attacker_max_ticks) {
            attacker_max_ticks = ticks
          }
          break
        }

        case CreepType.RANGED_ATTACKER: {
          this.ranged_attackers.push(creep)
          break
        }

        default:
          console.log(`RemoteHarvesterSquad unexpected creep type ${creep.memory.type}, ${this.name}, ${creep.pos}`)
          break
      }
    })

    let attacker_spawn_ticks_before = 200
    if (squad_memory.attacker_spawn_ticks_before) {
      attacker_spawn_ticks_before = squad_memory.attacker_spawn_ticks_before
    }

    this.need_attacker = !(!squad_memory.need_attacker) && (attacker_max_ticks < attacker_spawn_ticks_before)

    // if (this.harvester_energy_unit <= capacity) {
      this.setNextCreep()
    // }

    const room_memory = Memory.rooms[this.room_name]
    if (room_memory) {
      this.is_room_attacked = !(!squad_memory.need_attacker) ? false : !(!room_memory.attacked_time)
    }
    else {
      this.is_room_attacked = false
    }

    if (Game.cpu.bucket < 6000) {
      // this.avoid_cpu_use = true
      // if (this.name == 'remote_harvester74144126') {
      //   console.log(`avoid_cpu_use`)
      // }
    }
    // else {
    //   if (this.name == 'remote_harvester74144126') {
    //     console.log(`!avoid_cpu_use`)
    //   }
    // }

    if (room) {
      const index = 0
      this.showDescription(room, index)
    }
  }

  private setNextCreep(): void {
    const room = Game.rooms[this.room_name] as Room | undefined

    if ((this.creeps.size == 0) && (!room || !room.controller || !room.controller.my)) {
      this.next_creep = CreepType.SCOUT
      return
    }

    if ((this.creeps.size == 1) && this.scout && (this.scout.room.name != this.room_name)) {
      // Don't spawn creep before the scout arrives the room
      return
    }

    if (this.is_room_attacked) {
      if ((Game.time % 13) == 5) {
        console.log(`RemoteHarvesterSquad.setNextCreep room ${this.room_name} is under attack ${this.name}`)
      }
      return
    }

    if (!room) {
      if (!this.scout) {
        this.next_creep = CreepType.SCOUT
        return
      }

      if (this.debug) {
        console.log(`RemoteHarvesterSquad.setNextCreep no room`)
      }
      return
    }

    if (this.need_attacker) {
      if (this.attackers.length <= 2) {
        this.next_creep = CreepType.ATTACKER
        return
      }
      else {
        console.log(`RemoteHarvesterSquad.setNextCreep unexpected error ${this.need_attacker} ${this.name} ${this.room_name}`)
      }
    }

    const squad_memory = Memory.squads[this.name] as RemoteHarvesterSquadMemory

    if (squad_memory.need_attacker && (this.ranged_attackers.length == 0)) {
      this.next_creep = CreepType.RANGED_ATTACKER
      return
    }

    if (!this.keeper && !this.is_room_attacked && room.controller && !room.controller.my) {
      if (!room.controller.reservation || (room.controller.reservation.ticksToEnd < 4000)) {
        this.next_creep = CreepType.CONTROLLER_KEEPER
        return
      }
      else {
        if (this.debug) {
          console.log(`RemoteHarvesterSquad.setNextCreep enough reserved`)
        }
      }
    }

    if ((squad_memory.room_contains_construction_sites.length > 0)) {

      let builder_max = 3
      if (squad_memory.builder_max) {
        builder_max = squad_memory.builder_max
      }

      if (this.builders.length < builder_max) {
        this.next_creep = CreepType.WORKER
      }
      return
    }

    const harvester_max = 1 // @todo:
    let needs_harvester = false

    this.source_info.forEach((info) => {
      if (info.harvesters.length < harvester_max) {
        needs_harvester = true
      }
    })

    if (needs_harvester) {
      this.next_creep = CreepType.HARVESTER
      return
    }

    const carrier_max = squad_memory.carrier_max || this.source_info.size

    if (this.carriers.length < carrier_max) {
      this.next_creep = CreepType.CARRIER
      return
    }
  }

  public get type(): SquadType {
    return SquadType.REMOET_HARVESTER
  }

  public static generateNewName(): string {
    return UID(SquadType.REMOET_HARVESTER)
  }

  public generateNewName(): string {
    return RemoteHarvesterSquad.generateNewName()
  }

  // --
  public get spawnPriority(): SpawnPriority {
    const memory = Memory.squads[this.name] as RemoteHarvesterSquadMemory
    if (memory.stop_spawming) {
      return SpawnPriority.NONE
    }

    if (!this.next_creep) {
      return SpawnPriority.NONE
    }

    switch (this.next_creep) {
      case CreepType.SCOUT:
        return SpawnPriority.NORMAL

      case CreepType.CONTROLLER_KEEPER:
        return SpawnPriority.NORMAL

      case CreepType.CARRIER:
        return SpawnPriority.NORMAL

      case CreepType.ATTACKER:
        return SpawnPriority.HIGH

      case CreepType.RANGED_ATTACKER:
        return SpawnPriority.HIGH

      default:
        return SpawnPriority.LOW
    }
  }

  public hasEnoughEnergy(energy_available: number, capacity: number): boolean {
    let max: number | undefined
    let energy_unit: number | undefined

    switch (this.next_creep) {
      case CreepType.SCOUT:
        return energy_available >= 50

      case CreepType.CONTROLLER_KEEPER:
        energy_unit = 650
        max = energy_unit * 2
        break

      case CreepType.WORKER:
        energy_unit = 200
        max = energy_unit * 8
        break

      case CreepType.HARVESTER: {
        energy_unit = this.harvester_energy_unit

        const room = Game.rooms[this.room_name]
        const energy_max = ((this.harvester_energy_unit < 500) || (room && (room.is_keeperroom || room.is_centerroom))) ? (energy_unit * 2) : energy_unit

        max = energy_max
        break
      }

      case CreepType.CARRIER:
        energy_unit = 150
        max = (energy_unit * 12) + 200
        break

      case CreepType.ATTACKER:
        return this.hasEnoughEnergyForGeneralAttacker(energy_available, capacity)

      case CreepType.RANGED_ATTACKER:
        return this.hasEnoughEnergyForRangedAttacker(energy_available, capacity)

      default:
        console.log(`RemoteHarvesterSquad.hasEnoughEnergy unexpected creep type ${this.next_creep}, ${this.name}`)
        return false
    }

    if (!max || !energy_unit) {
      console.log(`RemoteHarvesterSquad.hasEnoughEnergy unexpected error ${this.next_creep}, ${max}, ${energy_unit}, ${energy_available}, ${this.name}`)
      return false
    }

    capacity = Math.min((capacity - 50), max)

    const energy_needed = (Math.floor(capacity / energy_unit) * energy_unit)

    return energy_available >= energy_needed
  }

  public addCreep(energy_available: number, spawn_func: SpawnFunction): void {
    switch (this.next_creep) {
      case CreepType.SCOUT:
        this.addGeneralCreep(spawn_func, [MOVE], CreepType.SCOUT)
        return

      case CreepType.CONTROLLER_KEEPER:
        this.addKeeper(energy_available, spawn_func)
        return

      case CreepType.WORKER:
        this.addBuilder(energy_available, spawn_func)
        return

      case CreepType.HARVESTER:
        this.addHarvester(energy_available, spawn_func)
        return

      case CreepType.CARRIER:
        this.addCarrier(energy_available, spawn_func)
        return

      case CreepType.ATTACKER:
        this.addGeneralAttacker(energy_available, spawn_func)
        return

      case CreepType.RANGED_ATTACKER:
        this.addBasicRangedAttacker(energy_available, spawn_func)
        return

      default:
        console.log(`RemoteHarvesterSquad.addCreep unexpected creep type ${this.next_creep}, ${this.name}`)
        return
    }
  }

  public run(): void {
    this.runScout()
    this.runKeeper()
    this.runBuilder()
    this.runHarvester()
    this.runCarrier()
    this.runAttacker()
    this.runRangedAttacker()
  }

  public description(): string {
    const detail = !(!this.scout) ? ` ${this.scout.pos}` : ''
    const number_of_creeps = `S${this.scout ? 1 : 0}K${this.keeper ? 1 : 0}A${this.attackers.length}RA${this.ranged_attackers.length}B${this.builders.length}H${this.harvesters.length}C${this.carriers.length}`
    return `${super.description()}, ${this.room_name}, ${this.next_creep}, ${number_of_creeps}${detail}`
  }

  // ---
  private addKeeper(energy_available: number, spawn_func: SpawnFunction): void {

    const body: BodyPartConstant[] = energy_available >= 1300 ? [MOVE, MOVE, CLAIM, CLAIM] : [MOVE, CLAIM]
    const name = this.generateNewName()
    const memory: RemoteHarvesterMemory = {
      ts: null,

      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CONTROLLER_KEEPER,
      should_notify_attack: false,
      let_thy_die: true,
      source_id: undefined,
      debug: this.debug,
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  private addHarvester(energy_available: number, spawn_func: SpawnFunction): void {
    const room = Game.rooms[this.room_name]
    const harvester_max = 1
    let source_id: string | undefined

    this.source_info.forEach((info) => {
      if (info.harvesters.length < harvester_max) {
        source_id = info.id
      }
    })

    if (!source_id) {
      console.log(`RemoteRoomHarvesterSquad.addHarvester no source ${this.source_ids}, ${Array.from(this.source_info.values()).map(info=>info.harvesters.length)}, ${this.name}`)
      return
    }

    const energy_unit = this.harvester_energy_unit

    const name = this.generateNewName()
    let body: BodyPartConstant[] = []
    const memory: RemoteHarvesterMemory = {
      ts: null,

      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.HARVESTER,
      should_notify_attack: false,
      let_thy_die: true,
      source_id,
      debug: this.debug,
    }

    const energy_max = ((this.harvester_energy_unit < 500) || (room && (room.is_keeperroom || room.is_centerroom))) ? (energy_unit * 2) : energy_unit

    energy_available = Math.min(energy_available, energy_max)
    while (energy_available >= energy_unit) {
      body = body.concat(this.harvester_body_unit)
      energy_available -= energy_unit
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  private addBuilder(energy_available: number, spawn_func: SpawnFunction): void {
    const body_unit: BodyPartConstant[] = [
      WORK, CARRY, MOVE,
    ]
    const energy_unit = 200

    const name = this.generateNewName()
    let body: BodyPartConstant[] = []
    const memory: RemoteHarvesterMemory = {
      ts: null,

      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.WORKER,
      should_notify_attack: false,
      let_thy_die: true,
      source_id: undefined,
      debug: this.debug,
    }

    energy_available = Math.min(energy_available, energy_unit * 8)
    while (energy_available >= energy_unit) {
      body = body.concat(body_unit)
      energy_available -= energy_unit
    }

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  private addCarrier(energy_available: number, spawn_func: SpawnFunction): void {
    const source_id = this.source_ids[0]

    if (!source_id) {
      console.log(`RemoteRoomHarvesterSquad.addCarrier no source ${this.source_ids}, ${this.name}`)
      return
    }

    const body_unit: BodyPartConstant[] = [
      CARRY, CARRY, MOVE
    ]
    const energy_unit = 150

    const name = this.generateNewName()
    let body: BodyPartConstant[] = []
    const memory: RemoteHarvesterMemory = {
      ts: null,

      squad_name: this.name,
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CARRIER,
      should_notify_attack: false,
      let_thy_die: true,
      source_id,
      debug: this.debug,
    }

    energy_available = Math.min(energy_available, (energy_unit * 12) + 200)
    energy_available -= 200

    while (energy_available >= energy_unit) {
      body = body.concat(body_unit)
      energy_available -= energy_unit
    }
    body = body.concat([WORK, CARRY, MOVE])

    const result = spawn_func(body, name, {
      memory: memory
    })
  }

  // --
  private runScout() {
    if (!this.scout) {
      return
    }
    const creep = this.scout

    if (creep.spawning) {
      return
    }

    const squad_memory = Memory.squads[this.name] as RemoteHarvesterSquadMemory

    if (((Game.time % 19) == 3) && (creep.room.name != this.base_room.name) && (squad_memory.room_contains_construction_sites.indexOf(creep.room.name) < 0) && (!creep.room.memory.is_gcl_farm)) {
      let has_construction_site = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: construction_site_filter
      }).length > 0

      if (!has_construction_site) {
        // has_construction_site = creep.room.find(FIND_FLAGS).length > 0
        // @todo: flag -> construction_site
      }

      if (has_construction_site) {
        (Memory.squads[this.name] as RemoteHarvesterSquadMemory).room_contains_construction_sites.push(creep.room.name)
      }
    }

    if (creep.moveToRoom(this.room_name) == ActionResult.IN_PROGRESS) {
      return
    }

    creep.moveTo(new RoomPosition(25, 25, creep.room.name))
  }

  private runKeeper(): void {
    if (!this.keeper) {
      return
    }
    if (this.keeper.spawning) {
      return
    }

    const creep = this.keeper

    const squad_memory = Memory.squads[this.name] as RemoteHarvesterSquadMemory

    if (((Game.time % 19) == 5) && (!creep.room.controller || !creep.room.controller.my) && (squad_memory.room_contains_construction_sites.indexOf(creep.room.name) < 0) && !creep.room.memory.is_gcl_farm) {
      const has_construction_site = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: construction_site_filter
      }).length > 0

      if (has_construction_site) {
        (Memory.squads[this.name] as RemoteHarvesterSquadMemory).room_contains_construction_sites.push(creep.room.name)
      }
    }

    if (creep.moveToRoom(this.room_name) == ActionResult.IN_PROGRESS) {
      return
    }

    creep.claim(this.room_name, false)
  }

  private runBuilder(): void {
    const squad_memory = Memory.squads[this.name] as RemoteHarvesterSquadMemory
    let done = false

    const move_to_ops: MoveToOpts = {
      maxRooms: 3,
    }

    this.builders.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      if (creep.room.name == 'W55S24') {
        if (this.escapeFromHostileIfNeeded(creep, this.room_name, this.keeper_lairs) == ActionResult.IN_PROGRESS) {
          if (creep.carry.energy > 0) {
            creep.memory.status = CreepStatus.BUILD
          }
          return
        }
      }

      if (creep.room.name == this.room_name) {
        if (this.escapeFromHostileIfNeeded(creep, this.room_name, this.keeper_lairs) == ActionResult.IN_PROGRESS) {
          if (creep.carry.energy > 0) {
            creep.memory.status = CreepStatus.BUILD
          }
          return
        }

        if (creep.carry.energy < creep.carryCapacity) {
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
            else {
              if (creep.room.storage && (creep.room.storage.store.energy > 0)) {
                if (creep.pos.isNearTo(creep.room.storage)) {
                  creep.withdraw(creep.room.storage, RESOURCE_ENERGY)
                }
                else {
                 creep.moveTo(creep.room.storage)
                }
              }
              else {
                const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                  filter: (structure: AnyStructure) => {
                    return (structure.structureType == STRUCTURE_CONTAINER) && (structure.store.energy > 0)
                  }
                })

                if (container) {
                  if (creep.pos.isNearTo(container)) {
                    creep.withdraw(container, RESOURCE_ENERGY)
                  }
                  else {
                    creep.moveTo(container, {maxRooms: 1})
                  }
                }
              }
            }
          }
        }
      }

      if ([CreepStatus.HARVEST, CreepStatus.BUILD].indexOf(creep.memory.status) < 0) {
        creep.memory.status = CreepStatus.HARVEST
      }

      if (creep.memory.status == CreepStatus.HARVEST) {
        if (creep.carry.energy > (creep.carryCapacity - (creep.getActiveBodyparts(WORK) * HARVEST_POWER))) {
          creep.memory.status = CreepStatus.BUILD
        }
        else {
          if (squad_memory.room_contains_construction_sites.indexOf(creep.room.name) < 0) {
            if (creep.moveToRoom(this.room_name) == ActionResult.IN_PROGRESS) {
              return
            }
          }

          if (creep.room.name == 'W45S7') {
            if (creep.moveToRoom(this.room_name) == ActionResult.IN_PROGRESS) {
              return
            }
          }

          const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => {
              return (structure.structureType == STRUCTURE_CONTAINER) && (structure.store.energy > 500)
            }
          })

          if (container) {
            if (creep.pos.isNearTo(container)) {
              creep.withdraw(container, RESOURCE_ENERGY)
            }
            else {
              creep.moveTo(container, move_to_ops)
            }
            return
          }

          let source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE)
          if (source) {
            if (creep.pos.isNearTo(source)) {
              creep.harvest(source)
            }
            else {
              const result = creep.moveTo(source, move_to_ops)
              if (result != OK) {
                creep.say(`E${result}`)
                creep.moveTo(new RoomPosition(25, 25, creep.room.name))
              }
            }
            return
          }

          // source = creep.pos.findClosestByPath(FIND_SOURCES)
          // if (source) {
          //   creep.moveTo(source, move_to_ops)
          //   return
          // }

          creep.say(`NO SRC`)
          // console.log(`RemoteHarvesterSquad.runBuilder can not find source in ${creep.room.name}, ${this.name}`)
          return
        }
      }

      if (creep.memory.status == CreepStatus.BUILD) {
        if (creep.carry.energy == 0) {
          creep.memory.status = CreepStatus.HARVEST
          return
        }

        const contained = squad_memory.room_contains_construction_sites.indexOf(creep.room.name) >= 0

        if (!contained) {
          const destination_room_name = squad_memory.room_contains_construction_sites[0]
          if (destination_room_name) {
            creep.moveToRoom(destination_room_name)
            return
          }

          creep.say(`DONE`)
          console.log(`RemoteHarvesterSquad.runBuilder done ${this.name}, ${room_link(this.room_name)}`)
          creep.memory.squad_name = this.region.worker_squad.name
          done = true
          return
        }

        if (!this.construction_sites) {
          this.construction_sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {filter: construction_site_filter})
        }

        let construction_site: ConstructionSite | null = null
        if (this.construction_sites && (this.construction_sites.length > 0)) {
          construction_site = creep.pos.findClosestByPath(this.construction_sites)
        }

        if (!construction_site && this.construction_sites && this.construction_sites[0]) {
          creep.say(`NO PATH`)
          construction_site = this.construction_sites[0]
        }

        if (!construction_site) {
          const flag = creep.pos.findClosestByPath(FIND_FLAGS, {
            filter: (f) => {
              return f.color == COLOR_BROWN
            }
          })

          if (flag) {
            const result = creep.room.createConstructionSite(flag.pos, STRUCTURE_ROAD)
            if (result == OK) {
              flag.remove()
            }
            else {
              flag.remove()
              console.log(`RemoteHarvesterSquad.runBuilder creating construction site failed: ${result} at ${flag.pos} in ${room_link(this.room_name)}, ${this.name}`)
            }
          }
          else {
            const index = squad_memory.room_contains_construction_sites.indexOf(creep.room.name)

            if (index >= 0) {
              (Memory.squads[this.name] as RemoteHarvesterSquadMemory).room_contains_construction_sites.splice(index, 1)
            }

            creep.memory.status = CreepStatus.HARVEST
          }
          return
        }

        creep.build(construction_site)
        creep.moveTo(construction_site)
      }
    })

    if (done) {
      const room_memory = Memory.rooms[this.room_name]

      if (room_memory && room_memory.cost_matrix) {
        Memory.rooms[this.room_name].cost_matrix = undefined
        console.log(`RemoteHarvesterSquad reset costmatrix ${this.room_name} ${this.name}`)
      }
    }
  }

  private runHarvester() {

    this.source_info.forEach((info) => {
      info.harvesters.forEach((creep) => {
        if (creep.spawning) {
          return
        }

        if ((creep.room.name == this.room_name) && (this.room_name != 'W49S6')) {
          if ((this.escapeFromHostileIfNeeded(creep, this.room_name, this.keeper_lairs) == ActionResult.IN_PROGRESS)) {
            if (creep.carry.energy > 0) {
              creep.drop(RESOURCE_ENERGY)
            }
            return
          }
        }

        if ((this.room_name == 'W54S15') && (creep.room.name == 'W55S15')) {
          creep.moveToRoom(this.room_name)
          return
        }

        runHarvester(creep, this.room_name, info.target, info.container, info.container, {
          resource_type: RESOURCE_ENERGY,
        })
      })
    })
  }

  private runCarrier(): void {
    this.carriers.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      if ((creep.room.name == this.room_name) && (this.room_name != 'W49S6')) {
        if ((this.escapeFromHostileIfNeeded(creep, this.room_name, this.keeper_lairs) == ActionResult.IN_PROGRESS)) {
          if (creep.store.getUsedCapacity() > 0) {
            creep.memory.status = CreepStatus.CHARGE
          }
          return
        }
      }

      if (creep.room.name == 'W47S5') {
        creep.moveToRoom('W46S5')
        return
      }

      const carry = creep.store.getUsedCapacity()
      const move_to_ops: MoveToOpts = {
        maxRooms: 3,
        maxOps: 1000,
        reusePath: 10,
      }

      if ((creep.room.name == 'W45S5') && (creep.carry.energy > (creep.carryCapacity * 0.9))) {
        creep.memory.status = CreepStatus.CHARGE
      }

      if ([CreepStatus.HARVEST, CreepStatus.CHARGE].indexOf(creep.memory.status) < 0) {
        creep.memory.status = CreepStatus.HARVEST
      }

      if ((this.builders.length > 0) && (creep.carry.energy > 0)) {
        const builder = creep.pos.findInRange(this.builders, 1, {
          filter: (b: Creep) => {
            return b.carry.energy < b.carryCapacity
          }
        })[0]

        if (builder) {
          creep.transfer(builder, RESOURCE_ENERGY)
        }
      }

      if (!this.avoid_cpu_use && (carry < (creep.carryCapacity - 50))) {
        let tombstone: Tombstone | undefined
        if (creep.memory.withdraw_resources_target) {
          tombstone = Game.getObjectById(creep.memory.withdraw_resources_target) as Tombstone | undefined

          if (!tombstone || (tombstone.store.getUsedCapacity() == 0)) {
            creep.memory.withdraw_resources_target = undefined
          }
          else {
            creep.say(`${tombstone.pos.x},${tombstone.pos.y}`)
          }
        }

        if (!tombstone && ((Game.time % 13) == 11) && creep.room.resourceful_tombstones && (creep.room.resourceful_tombstones.length > 0)) {
          tombstone = creep.pos.findInRange(creep.room.resourceful_tombstones, 20)[0]
        }

        if (tombstone) {
          creep.memory.withdraw_resources_target = tombstone.id
          const withdraw_result = creep.withdrawResources(tombstone)

          if (withdraw_result == ERR_NOT_IN_RANGE) {
            creep.moveTo(tombstone, move_to_ops)
            creep.say(`${tombstone.pos.x},${tombstone.pos.y}`)
          }
          else if (withdraw_result == OK) {
            creep.memory.withdraw_resources_target = undefined
          }
          return
        }

        let drop: Resource | undefined
        if (creep.memory.pickup_target) {
          drop = Game.getObjectById(creep.memory.pickup_target) as Resource | undefined

          if (!drop || (drop.amount == 0)) {
            creep.memory.pickup_target = undefined
          }
          else {
            creep.say(`${drop.pos.x},${drop.pos.y}`)
          }
        }

        if (!drop && ((Game.time % 4) == 1) && !((creep.room.name == this.base_room.name) && !this.destination)) {
          drop = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 4)[0]
        }

        if (drop) {
          if (creep.pos.isNearTo(drop)) {
            const pickup_result = creep.pickup(drop)
            creep.memory.pickup_target = drop.id

            if (pickup_result == OK) {
              creep.memory.pickup_target = undefined
            }
          }
          else {
            creep.moveTo(drop, {maxRooms: 1, reusePath: 10})
          }
          return
        }
      }

      const should_escape = ((creep.room.attacker_info().attacked && !creep.room.is_keeperroom) || (this.is_room_attacked)) && (this.room_name != 'W49S6')
      if (should_escape) {
        if (carry > 0) {
          creep.memory.status = CreepStatus.CHARGE
        }

        if ((carry == 0) && (creep.room.name == this.base_room.name)) {
          creep.moveTo(new RoomPosition(25, 25, creep.room.name))
          creep.say(`RUN`)
          return
        }
      }

      if (creep.memory.status == CreepStatus.HARVEST) {
        if (carry > (creep.carryCapacity * 0.95)) {
          creep.memory.status = CreepStatus.CHARGE
        }
        else {
          if (!this.avoid_cpu_use && (creep.carry.energy > 0)) {
            const damaged_structure = creep.pos.findInRange(FIND_STRUCTURES, 2, {
              filter: (structure: AnyStructure) => {
                if (structure.structureType == STRUCTURE_ROAD) {
                  return structure.hits < (structure.hitsMax * 0.9)
                }
                if (structure.structureType == STRUCTURE_CONTAINER) {
                  return structure.hits < (structure.hitsMax * 0.9)
                }
                return false
              }
            })[0]

            if (damaged_structure) {
              creep.repair(damaged_structure)
            }
          }

          if (creep.moveToRoom(this.room_name) == ActionResult.IN_PROGRESS) {
            return
          }

          if (this.containers_with_energy.length > 0) {
            const container = creep.pos.findClosestByPath(this.containers_with_energy)

            if (container) {
              if (creep.pos.getRangeTo(container) <= 1) {
                creep.withdraw(container, RESOURCE_ENERGY)
              }
              else {
                creep.moveTo(container, move_to_ops)
              }
              return
            }
          }

          if (this.containers.length > 0) {
            const closest_container = creep.pos.findClosestByPath(this.containers)

            if (closest_container) {
              if (creep.pos.getRangeTo(closest_container) <= 1) {
                const withdraw_result = creep.withdraw(closest_container, RESOURCE_ENERGY)

                if (withdraw_result == ERR_NOT_ENOUGH_RESOURCES) {
                  if ((Game.time % 11) == 0) {
                    creep.move(((Game.time % 8) + 1) as DirectionConstant)
                  }
                }
              }
              else {
                creep.moveTo(closest_container, move_to_ops)
              }
              return
            }
          }

          // const destination = creep.pos.findClosestByPath(creep.room.sources)

          // if (destination) {
          //   if (creep.pos.getRangeTo(destination) > 3) {
          //     creep.moveTo(destination,move_to_ops)
          //   }
          // }
        }
      }

      const has_minerals = ((carry - creep.carry.energy) > 0)

      if (creep.memory.status == CreepStatus.CHARGE) {
        if (!has_minerals && (creep.carry.energy < (creep.carryCapacity * 0.2)) && !should_escape) {
          creep.memory.status = CreepStatus.HARVEST
          return
        }

        if (!this.avoid_cpu_use && (creep.carry.energy > 0)) {
          const is_farm = creep.room.memory && creep.room.memory.is_gcl_farm

          if (!is_farm && creep.room.controller && creep.room.controller.my && creep.room.owned_structures) {
            const extensions: StructureExtension[] = creep.room.owned_structures.get(STRUCTURE_EXTENSION) as StructureExtension[]
            const extension = creep.pos.findInRange(extensions, 1, {
              filter: (structure: StructureExtension) => {
                return structure.energy < structure.energyCapacity
              }
            })[0]

            if (extension) {
              creep.transfer(extension, RESOURCE_ENERGY)
            }
          }
          else {
            const damaged_structure = creep.pos.findInRange(FIND_STRUCTURES, 2, {
              filter: (structure: AnyStructure) => {
                if (structure.structureType == STRUCTURE_ROAD) {
                  return structure.hits < (structure.hitsMax * 0.9)
                }
                if (structure.structureType == STRUCTURE_CONTAINER) {
                  return structure.hits < (structure.hitsMax * 0.9)
                }
                return false
              }
            })[0]

            if (damaged_structure) {
              creep.repair(damaged_structure)
            }
          }
        }

        // if (creep.moveToRoom(this.destination.room.name) == ActionResult.IN_PROGRESS) {
        //   return
        // }

        if (!this.destination) {
          if (this.base_room.name == 'E17S4') {
            if (creep.moveToRoom(this.base_room.name) == ActionResult.IN_PROGRESS) {
              return
            }

            const x = 36
            const y = 15
            const room_position = new RoomPosition(x, y, this.base_room.name)

            if ((creep.room.name != this.base_room.name)) {
              creep.moveTo(room_position, {maxRooms: 3, reusePath: 10})
              return
            }

            if ((creep.carry.energy == 0) && (carry > 0)) {
              const container: StructureContainer | undefined = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                  return (structure.structureType == STRUCTURE_CONTAINER) && structure.store.getFreeCapacity() > 0
                }
              }) as StructureContainer | undefined

              if (container) {
                if (creep.transferResources(container) == ERR_NOT_IN_RANGE) {
                  creep.moveTo(container)
                }
              }
              else {
                creep.dropResources()
              }
              return
            }

            if ((creep.pos.x != x) || (creep.pos.y != y)) {
              creep.moveTo(room_position, {maxRooms: 3, reusePath: 10})
              return
            }

            creep.drop(RESOURCE_ENERGY)

            return
          }

          creep.say(`ERR`)
          console.log(`ERROR`)
          return
        }

        if (!has_minerals || !this.destination.room.storage) {
          if (creep.pos.isNearTo(this.destination)) {
            const transfer_result = creep.transfer(this.destination, RESOURCE_ENERGY)
            if (transfer_result != OK) {
              creep.say(`E${transfer_result}`)
            }
          }
          else {
              // const ignore_creeps = (Game.time % 5) < 3

              if (['W46S26', 'W45S26', 'W47S7'].indexOf(creep.room.name) >= 0) {
                creep.moveToRoom(this.destination.room.name)
                return
              }
              else if (creep.room.name == 'W46S5') {
                creep.moveTo(new RoomPosition(17, 49, creep.room.name))
              }
              else {
                if (creep.moveTo(this.destination, move_to_ops) == ERR_NO_PATH) {
                  creep.say(`NO PATH`)
                  creep.moveToRoom(this.destination.room.name)
                }
              }
          }
        }
        else {
          const transfer_result = creep.transferResources(this.destination.room.storage)
          if (transfer_result == ERR_NOT_IN_RANGE) {
            if (['W46S26', 'W45S26', 'W47S7'].indexOf(creep.room.name) >= 0) {
              creep.moveToRoom(this.destination.room.name)
              return
            }

            move_to_ops.maxRooms = 5
            if (creep.room.name == 'W46S5') {
              creep.moveTo(new RoomPosition(17, 49, creep.room.name))
            }
            else {
              creep.moveTo(this.destination.room.storage, move_to_ops)
            }
          }
          else if (transfer_result != OK) {
            creep.say(`E${transfer_result}`)
          }
        }
      }
    })
  }

  private runAttacker(): void {
    const squad_memory = Memory.squads[this.name] as RemoteHarvesterSquadMemory

    if (squad_memory && squad_memory.defend_room_name && (this.ranged_attackers.length > 0)) {
      const defend_room_memory = Memory.rooms[squad_memory.defend_room_name]

      if (defend_room_memory && defend_room_memory.attacked_time) {
        this.defendRoom(squad_memory.defend_room_name)
        return
      }
    }

    this.attackers.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      if ((creep.room.name != this.room_name) && (creep.searchAndDestroyTo(this.room_name, false) == ActionResult.IN_PROGRESS)) {
        return
      }

      const closest_hostile = creep.pos.findClosestByPath(creep.room.attacker_info().hostile_creeps)

      if (closest_hostile) {
        creep.destroy(closest_hostile)
        return
      }

      const keeper_lair = this.keeper_lairs.sort((lhs, rhs) => {
        const l_ticks = (lhs.ticksToSpawn || 0)
        const r_ticks = (rhs.ticksToSpawn || 0)
        if (l_ticks < r_ticks) return -1
        if (l_ticks > r_ticks) return 1
        return 0
      })[0]

      if (keeper_lair) {
        const range = creep.pos.getRangeTo(keeper_lair)

        if ((creep.hits < creep.hitsMax) && (range < 8)) {
        }
        else {
          creep.moveTo(keeper_lair, {maxRooms: 3})
        }
      }

      creep.healNearbyCreep()
    })
  }

  private defendRoom(room_name: string): void {
    this.attackers.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      creep.searchAndDestroyTo(room_name, false)
    })
  }

  private runRangedAttacker(): void {
    const attacker = this.attackers.filter((creep) => {
      return !creep.spawning
    })[0]

    this.ranged_attackers.forEach((creep) => {
      if (creep.spawning) {
        return
      }

      // if (creep.moveToRoom(this.room_name) == ActionResult.IN_PROGRESS) {
      //   return
      // }

      let no_move: boolean

      if (attacker) {
        no_move = true
      }
      else {
        no_move = false
      }

      const opt: CreepSearchAndDestroyOption = {
        ignore_source_keeper: false,
        no_move: no_move,
      }

      creep.searchAndDestroy(opt)

      if (attacker) {
        // creep.say(`M2A`)
        if (['W45S27'].indexOf(creep.room.name) >= 0) {
          creep.moveToRoom(attacker.room.name)
          return
        }

        creep.moveTo(attacker, {maxRooms: 3})
      }
      else {
        // creep.say(`NOATT`)
      }
    })
  }
}

const construction_site_filter = (site: ConstructionSite): boolean => {
  if (site.structureType == STRUCTURE_ROAD) {
    return true
  }
  if (site.structureType == STRUCTURE_EXTRACTOR) {
    return true
  }
  if (site.structureType == STRUCTURE_CONTAINER) {
    return false
  }
  return false
}

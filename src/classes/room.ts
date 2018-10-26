import { SquadType } from "./squad/squad"
import { RemoteHarvesterSquadMemory } from './squad/remote_harvester'
import { RoomLayout, RoomLayoutOpts } from "./room_layout"
import { UID, room_history_link, room_link, leveled_colored_text } from './utils';
import { RemoteMineralHarvesterSquadMemory } from "./squad/remote_m_harvester";
import { ErrorMapper } from "utils/ErrorMapper";

export interface AttackerInfo  {
  attacked: boolean
  heavyly_attacked: boolean

  hostile_creeps: Creep[]
  hostile_teams: string[]
  attack: number
  ranged_attack: number
  heal: number
  work: number
  tough: number
}

export type ChargeTarget = StructureExtension | StructureSpawn | StructureTower | StructureTerminal | StructureLab | StructurePowerSpawn | StructureContainer

declare global {
  interface RoomMemory {
    harvesting_source_ids: string[]
    cost_matrix?: number[] | undefined
    attacked_time?: number
    last_attacked_time?: number
    description_position?: {x:number, y:number}
    exits?: {[exit: number]: {x:number, y:number}}
    ancestor?: string
    is_gcl_farm?: boolean
  }

  interface Room {
    sources: Source[]
    spawns: StructureSpawn[]  // Initialized in Spawn.initialize()
    resourceful_tombstones: Tombstone[]
    is_keeperroom: boolean
    is_centerroom: boolean
    cost_matrix(): CostMatrix | undefined
    construction_sites?: ConstructionSite[]  // Only checked if controller.my is true
    owned_structures?: Map<StructureConstant, AnyOwnedStructure[]>
    _attacker_info: AttackerInfo | undefined
    attacker_info(): AttackerInfo
    connected_rooms(): string[]

    owned_structures_not_found_error(structure_type: StructureConstant): void
    add_remote_harvester(owner_room_name: string, carrier_max: number, opts?: {dry_run?: boolean, memory_only?: boolean, no_flags_in_base?: boolean, no_memory?: boolean}): string[] | null
    add_remote_mineral_harvester(owner_room_name: string, opts?:{forced?: boolean}): string | null
    remote_layout(x: number, y: number): CostMatrix | null
    test(from: Structure): void
    place_construction_sites(): void
    source_road_positions(from_position: RoomPosition): RoomPosition[] | null

    show_layout(name: string, opts?: RoomLayoutOpts): RoomLayout | null
    place_layout(name: string, opts?: RoomLayoutOpts): RoomLayout | null
    remove_all_flags(): void

    show_weakest_walls(opts?:{max?: number}): void

    info(): void

    initialize(): void

    structures_needed_to_be_charged?: ChargeTarget[]
  }

  interface RoomVisual {
    multipleLinedText(text: string | string[], x: number, y: number, style?: TextStyle): void
  }
}

export function tick(): void {
  Room.prototype.initialize = function() {
    let room_memory: RoomMemory | undefined = Memory.rooms[this.name] as RoomMemory | undefined

    if (!room_memory) {
      room_memory = {
        harvesting_source_ids: [],
      }
      Memory.rooms[this.name] = room_memory
    }

    this.sources = this.find(FIND_SOURCES)

    this.resourceful_tombstones = this.find(FIND_TOMBSTONES, {
      filter: (tombstone: Tombstone) => {
        const sum = _.sum(tombstone.store)
        const mineral_amount = sum - tombstone.store.energy
        return mineral_amount > 0
      }
    })

    if (!this.resourceful_tombstones) {
      this.resourceful_tombstones = []
    }

    if (this.controller && this.controller.my) {
      this.construction_sites = this.find(FIND_CONSTRUCTION_SITES, {
        filter: (site: ConstructionSite) => site.my
      })
    }

    if (this.controller && this.controller.my) {
      this.owned_structures = new Map<StructureConstant, AnyOwnedStructure[]>()

      this.find(FIND_MY_STRUCTURES).forEach((structure: AnyOwnedStructure) => {
        // if (!structure.isActive()) { // consumes too much CPU
        //   return
        // }
        let structure_list: AnyOwnedStructure[] | null = this.owned_structures.get(structure.structureType)
        if (!structure_list) {
          structure_list = []
        }

        structure_list.push(structure)
        this.owned_structures.set(structure.structureType, structure_list)
      })
    }

    const prefix = (Number(this.name.slice(1,3)) + 6) % 10
    const suffix = (Number(this.name.slice(4,6)) + 6) % 10
    this.is_centerroom = ((prefix == 1) && (suffix == 1))
    this.is_keeperroom = (prefix <= 2) && (suffix <= 2) && !this.is_centerroom
  }

  Room.prototype.cost_matrix = function(): CostMatrix | undefined {
    if (!this.is_keeperroom) {
      return undefined
    }

    let cost_matrix: CostMatrix | undefined = Game.get_costmatrix(this.name)
    if (cost_matrix) {
      return cost_matrix
    }

    let room_memory: RoomMemory | undefined = Memory.rooms[this.name] as RoomMemory | undefined
    if (!room_memory) {
      console.log(`Room.cost_matrix() unexpectedly find null room memory ${this.name}`)
      return undefined
    }
    if (room_memory.cost_matrix) {
      let cost_matrix = PathFinder.CostMatrix.deserialize(room_memory.cost_matrix)

      if (cost_matrix) {
        Game.set_costmatrix(this.name, cost_matrix)
        return cost_matrix
      }
      else {
        console.log(`Room.cost_matrix() unexpectedly find null cost matrix from PathFinder.CostMatrix.deserialize() ${this.name}`)
      }
    }

    cost_matrix = create_cost_matrix_for(this)
    if (!cost_matrix) {
      console.log(`Room.cost_matrix() unexpectedly find null cost matrix from create_cost_matrix_for() ${this.name}`)
      return undefined
    }

    room_memory.cost_matrix = cost_matrix.serialize()
    Game.set_costmatrix(this.name, cost_matrix)

    return cost_matrix
  }

  Room.prototype.attacker_info = function(): AttackerInfo {
    const room = this as Room

    if (room._attacker_info) {
      return room._attacker_info
    }

    const attacker_info: AttackerInfo = {
      attacked: false,
      heavyly_attacked: false,
      hostile_creeps: [],
      hostile_teams: [],
      attack: 0,
      ranged_attack: 0,
      heal: 0,
      work: 0,
      tough: 0,
    }

    attacker_info.hostile_creeps = room.find(FIND_HOSTILE_CREEPS, {
      filter: (creep: Creep) => {
        if (!Game.isEnemy(creep)) {
          return false
        }

        if (creep.pos.x == 0) {
          return false
        }
        if (creep.pos.x == 49) {
          return false
        }
        if (creep.pos.y == 0) {
          return false
        }
        if (creep.pos.y == 49) {
          return false
        }

        return true
      }
    })

    attacker_info.hostile_creeps.forEach((creep: Creep) => {
      if (attacker_info.hostile_teams.indexOf(creep.owner.username) < 0) {
        attacker_info.hostile_teams.push(creep.owner.username)
      }

      attacker_info.attack += creep.getActiveBodyparts(ATTACK)
      attacker_info.ranged_attack += creep.getActiveBodyparts(RANGED_ATTACK)
      attacker_info.heal += creep.getActiveBodyparts(HEAL)
      attacker_info.work += creep.getActiveBodyparts(WORK)
      attacker_info.tough += creep.getActiveBodyparts(TOUGH)
    })

    attacker_info.attacked = (attacker_info.hostile_creeps.length > 0)

    const number_of_attacks = (attacker_info.attack * 2) + attacker_info.ranged_attack + (attacker_info.heal * 5)
    attacker_info.heavyly_attacked = number_of_attacks > 16

    if (room.memory.attacked_time) {
      room.memory.last_attacked_time = room.memory.attacked_time
    }

    if (attacker_info.attacked) {
      room.memory.attacked_time = Game.time
    }
    else {
      room.memory.attacked_time = undefined
    }

    room._attacker_info = attacker_info
    return attacker_info
  }

  Room.prototype.connected_rooms = function(): string[] {
    const room = this as Room

    const exits = Game.map.describeExits(room.name)
    const room_names: string[] = ([TOP, BOTTOM, LEFT, RIGHT]).map(direction => {
      if (exits[direction]) {
        return exits[direction]
      }
      return null
    }).filter(room_name => {
      return !(!room_name)
    }) as string[]

    return room_names
  }

  Room.prototype.owned_structures_not_found_error = function(structure_type: StructureConstant): void {
    if ((Game.time % 13) == 3) {
      const message = `Room.owned_structures_not_found_error ${structure_type} ${room_link(this.name)}`
      console.log(leveled_colored_text(message, 'warn'))
    }
  }

  Room.prototype.add_remote_harvester = function(owner_room_name: string, carrier_max: number, opts?: {dry_run?: boolean, memory_only?: boolean, no_flags_in_base?: boolean, no_memory?: boolean}): string[] | null {
    opts = opts || {}
    const dry_run = !(opts.dry_run == false)
    const no_flags_in_base = !(!opts.no_flags_in_base)
    const no_memory = !(!opts.no_memory)
    console.log(`Room.add_remote_harvester dry_run: ${dry_run} at ${Game.time}`)

    const room = this as Room
    const room_name = room.name

    const owner_room = Game.rooms[owner_room_name]
    if (!owner_room) {
      console.log(`Room.add_remote_harvester no destination room ${owner_room_name}, ${room.name}`)
      return null
    }
    // if (!owner_room.storage) {
    //   console.log(`Room.add_remote_harvester no storage in room ${owner_room_name}`)
    //   return null
    // }

    let destination_position: RoomPosition

    if (owner_room.storage && owner_room.storage.my) {
      destination_position = owner_room.storage.pos
    }
    else {
      const storage_flag = owner_room.find(FIND_FLAGS, {filter: f=>(f.color == COLOR_GREEN)})[0]

      if (storage_flag) {
        destination_position = storage_flag.pos
      }
      else {
        console.log(`Room.add_remote_harvester no my storage nor storage flag in room ${owner_room_name}`)
        return null
      }
    }
    if (!room.sources || (room.sources.length == 0)) {
      console.log(`Room.add_remote_harvester no sources in room ${room.name}, ${room.sources}`)
      return null
    }

    console.log(`destination_position: ${destination_position}`)

    if (!opts.memory_only) {
      // --- Path
      const road_positions = room.source_road_positions(destination_position)
      if (!road_positions) {
        console.log(`Room.add_remote_harvester no road positions ${room.name}`)
        return null
      }

      // -- Dry Run
      if (dry_run) {
        road_positions.forEach((pos) => {
          const r = Game.rooms[pos.roomName]
          if (!r) {
            return
          }

          r.visual.text(`x`, pos, {
            color: '#ff0000',
            align: 'center',
            font: '12px',
            opacity: 0.8,
          })
        })

        return null
      }

      // --- Place flags
      const time = Game.time

      road_positions.forEach((pos) => {
        const r = Game.rooms[pos.roomName]
        if (!r) {
          return
        }
        if (no_flags_in_base && (pos.roomName == owner_room_name)) {
          return
        }

        const name = UID(`Flag${time}`)
        r.createFlag(pos, name, COLOR_BROWN, COLOR_BROWN)

        // r.createConstructionSite(pos, STRUCTURE_ROAD)
      })
    }

    if (!no_memory && !dry_run) {
      let result: string[] = []

      // --- Remote Harvester Squad Memory
      let harvester_squad_name = `remote_harvester_${room.name.toLowerCase()}`

      while (Memory.squads[harvester_squad_name]) {
        harvester_squad_name = `${harvester_squad_name}_1`
      }
      result.push(harvester_squad_name)

      const sources: {[index: string]: {container_id?: string}} = {}

      room.find(FIND_SOURCES).forEach((source) => {
        sources[source.id] = {}
      })

      const squad_memory: RemoteHarvesterSquadMemory = {
        name: harvester_squad_name,
        type: SquadType.REMOET_HARVESTER,
        owner_name: owner_room_name,
        number_of_creeps: 0,
        stop_spawming: true,
        room_name: room.name,
        sources,
        room_contains_construction_sites: [],
        carrier_max,
        need_attacker: room.is_keeperroom,
        builder_max: room.is_keeperroom ? 5 : 3,
      }

      Memory.squads[harvester_squad_name] = squad_memory

      // --- Remote Mineral Harvester Memory
      const mineral_harvester_name = room.add_remote_mineral_harvester(owner_room_name) // @todo: not tested yet
      if (mineral_harvester_name) {
        result.push(mineral_harvester_name)
      }

      // --- Region Memory
      const region_memory = Memory.regions[owner_room_name]
      if (!room.is_keeperroom) {
        if (region_memory) {
          if (!region_memory.rooms_need_to_be_defended) {
            Memory.regions[owner_room_name].rooms_need_to_be_defended = []
          }

          Memory.regions[owner_room_name].rooms_need_to_be_defended!.push(room_name)
        }
        else {
          console.log(`Room.add_remote_harvester region memory ${owner_room_name} does not exist`)
        }
      }

      return result
    }
    return null
  }

  Room.prototype.add_remote_mineral_harvester = function(owner_room_name: string, opts?:{forced?: boolean}): string | null {
    opts = opts || {}

    const room = this as Room

    if (!room.is_keeperroom && !opts.forced) {
      console.log(`Room.add_remote_mineral_harvester ${room.name} is not a source keeper room`)
      return null
    }

    const mineral = room.find(FIND_MINERALS)[0]
    if (!mineral) {
      console.log(`Room.add_remote_mineral_harvester no mineral found in ${room.name}`)
      return null
    }

    const keeper_lair = mineral.pos.findInRange(FIND_HOSTILE_STRUCTURES, 5, {
      filter: (s: Structure) => s.structureType == STRUCTURE_KEEPER_LAIR
    })[0]
    if (!keeper_lair) {
      console.log(`Room.add_remote_mineral_harvester no keeper lair found in ${room.name} nearby ${mineral.pos}`)
    }

    let mineral_harvester_name = `remote_m_harvester_${room.name.toLowerCase()}`
    while (Memory.squads[mineral_harvester_name]) {
      mineral_harvester_name = `${mineral_harvester_name}_1`
    }

    const room_distance = Game.map.getRoomLinearDistance(owner_room_name, room.name)
    const number_of_carriers = (room_distance <= 1) ? 1 : 2

    const memory: RemoteMineralHarvesterSquadMemory = {
      room_name: room.name,
      mineral_id: mineral.id,
      keeper_lair_id: keeper_lair ? keeper_lair.id : undefined,
      number_of_carriers,
      name: mineral_harvester_name,
      type: SquadType.REMOET_M_HARVESTER,
      owner_name: owner_room_name,
      stop_spawming: true,
      number_of_creeps: 0,
    }

    Memory.squads[mineral_harvester_name] = memory

    return mineral_harvester_name
  }

  Room.prototype.remote_layout = function(x: number, y: number): CostMatrix | null {

    const room = this as Room
    const road_cost = 1

    const cost_matrix = new PathFinder.CostMatrix()
    cost_matrix.add_terrain(room)
    cost_matrix.add_normal_structures(room, {ignore_public_ramparts: true})

    const costCallback = (room_name: string): boolean | CostMatrix => {
      if ((room.name == room_name)) {
        return cost_matrix
      }
      return false
    }

    const pathfinder_opts: FindPathOpts = {
      maxRooms: 1,
      maxOps: 10000,
      range: 1,
      costCallback,
    }

    let result: CostMatrix | null = cost_matrix
    const from_pos = new RoomPosition(x, y, room.name)

    room.sources.forEach((source, index) => {
      const path = room.findPath(from_pos, source.pos, pathfinder_opts)
      if (!path || (path.length == 0)) {
        result = null
        console.log(`Room.remote_layout cannot find path for ${from_pos} to ${source.pos}, ${path}`)
        return
      }

      path.forEach((pos) => {
        cost_matrix.set(pos.x, pos.y, road_cost)
      })
    })

    cost_matrix.show(room, {colors: {1: '#ff0000'}})

    return result
  }

  Room.prototype.show_layout = function(name: string, opts?: RoomLayoutOpts): RoomLayout | null {
    const room = this as Room
    let layout: RoomLayout | null = null

    ErrorMapper.wrapLoop(() => {
      layout = new RoomLayout(room, name, opts)
      layout.show()
    }, `Room.show_layout`)()

    return layout
  }

  Room.prototype.place_layout = function(name: string, opts?: RoomLayoutOpts): RoomLayout | null {
    const room = this as Room
    let layout: RoomLayout | null = null

    ErrorMapper.wrapLoop(() => {
      layout = new RoomLayout(room, name, opts)
      layout.place_flags()
    }, `Room.place_layout`)()

    return layout
  }

  Room.prototype.remove_all_flags = function(): void {
    const room = this as Room

    room.find(FIND_FLAGS).forEach((flag) => {
      flag.remove()
    })
  }

  Room.prototype.test = function(from: Structure): void {
    const room = this as Room
    // const cost_matrix = room.remote_layout()

    const pathfinder_opts: FindPathOpts = {
      maxRooms: 1,
      maxOps: 10000,
      range: 1,
    }

    const path = from.room.findPath(from.pos, room.sources[0].pos, pathfinder_opts)

    if (!path || (path.length == 0)) {
      console.log(`TEST no path`)
      return
    }

    console.log(`TEST ${path.length} paths`)

    const last_pos = path[path.length - 1]
    const start_pos: {x: number, y: number} = {
      x: last_pos.x,
      y: last_pos.y,
    }

    if (start_pos.x == 0) {
      start_pos.x = 49
    }
    else if (start_pos.x == 49) {
      start_pos.x = 0
    }

    if (start_pos.y == 0) {
      start_pos.y = 49
    }
    else if (start_pos.y == 49) {
      start_pos.y = 0
    }

    console.log(`TEST start pos: (${start_pos.x}, ${start_pos.y})`)

    path.forEach((pos) => {
      room.visual.text(`■`, pos.x, pos.y, {
        color: '#ff0000',
        align: 'center',
        font: '12px',
        opacity: 0.8,
      })
    })
  }

  Room.prototype.place_construction_sites = function(): void {
    const room = this as Room
    let message = ''

    if (room.construction_sites && (room.construction_sites.length > 0)) {
      return
    }

    let count = 0

    for (const flag_name in Game.flags) {
      const flag = Game.flags[flag_name]
      if (!flag.room) {
        continue
      }
      if ((flag.room.name != room.name)) {
        continue
      }

      let structure_type: StructureConstant | undefined

      switch (flag.color) {
        case COLOR_RED:
          structure_type = STRUCTURE_TOWER
          break

        case COLOR_BLUE:
          structure_type = STRUCTURE_LAB
          break

        case COLOR_GREEN:
          structure_type = STRUCTURE_STORAGE
          break

        case COLOR_PURPLE:
          structure_type = STRUCTURE_TERMINAL
          break

        case COLOR_YELLOW:
          structure_type = STRUCTURE_EXTRACTOR
          break

        case COLOR_GREY:
          structure_type = STRUCTURE_SPAWN
          break

        case COLOR_ORANGE:
          structure_type = STRUCTURE_LINK
          break

        case COLOR_CYAN:
          structure_type = STRUCTURE_NUKER
          break

        case COLOR_BROWN:
          structure_type = STRUCTURE_ROAD
          break
      }

      if (!structure_type) {
        structure_type = STRUCTURE_EXTENSION
      }

      let result = room.createConstructionSite(flag.pos, structure_type)
      if ((result == ERR_RCL_NOT_ENOUGH) && (structure_type == STRUCTURE_SPAWN)) {
        result = room.createConstructionSite(flag.pos, STRUCTURE_POWER_SPAWN)
      }


      if (result == OK) {
        if (structure_type != STRUCTURE_ROAD) {
          count += 1
        }
        console.log(`Place ${structure_type} construction site on ${flag.name}, ${flag.pos}, ${flag.color}, ${room_link(flag.pos.roomName)}`)
        flag.remove()

        if (count > 0) {

          break // If deal with all flags once, createConstructionSite() succeeds each call but when it actually runs (that is the end of the tick) it fails
          // so call it one by one
        }
      }
      else if (result == ERR_INVALID_TARGET) {
        message += `ERROR ${structure_type} construction site invalid args: removing ${flag.name}, ${flag.pos}, ${flag.color}, ${room_link(flag.pos.roomName)}\n`
        flag.remove()
      }
      else if (result != ERR_RCL_NOT_ENOUGH) {
        message += `ERROR Place ${structure_type} construction site failed E${result}: ${flag.name}, ${flag.pos}, ${flag.color}, ${room_link(flag.pos.roomName)}\n`
      }
    }

    if (message.length > 0) {
      console.log(message)
      Game.notify(message)
    }
  }

  Room.prototype.source_road_positions = function(from_position: RoomPosition): RoomPosition[] | null {
    const room = this as Room

    const from_room = Game.rooms[from_position.roomName]
    if (!from_room) {
      console.log(`Room.source_road_positions no destination room ${from_position.roomName}, ${room.name}`)
      return null
    }

    const pathfinder_opts: FindPathOpts = {
      maxRooms: 1,
      maxOps: 10000,
      range: 1,
    }

    // if (room.is_keeperroom && (room.sources.length >= 2)) {
    //   const closest_source = from_position.findClosestByPath(room.sources)
    //   if (!closest_source) {
    //     console.log(`Room.source_road_positions unexpected error no closest source from ${from_position} in ${room.name}`)
    //     return null
    //   }

    //   pathfinder_opts.maxRooms = 0
    //   let road_positions: RoomPosition[] = []

    //   room.sources.filter((source) => {
    //     return source.id != closest_source.id
    //   }).forEach((source) => {
    //     const path = from_room.findPath(closest_source.pos, source.pos, pathfinder_opts)
    //     if (!path || (path.length == 0)) {
    //       console.log(`Room.add_remote_harvester cannot find path from ${closest_source.pos} to ${source.pos}, ${room.name}`)
    //       return
    //     }

    //     const positions = path.map((p) => {
    //       return new RoomPosition(p.x, p.y, from_room.name)
    //     })
    //     road_positions = road_positions.concat(positions)
    //   })

    //   pathfinder_opts.maxRooms = 1

    // }
    // else {
      const path = from_room.findPath(from_position, room.sources[0].pos, pathfinder_opts)

      if (!path || (path.length == 0)) {
        console.log(`Room.add_remote_harvester cannot find path from ${from_position} to ${room.sources[0].pos}, ${room.name}`)
        return null
      }

      const last_pos = path[path.length - 1]
      const start_pos: {x: number, y: number} = {
        x: last_pos.x,
        y: last_pos.y,
      }

      if (start_pos.x == 0) {
        start_pos.x = 49
      }
      else if (start_pos.x == 49) {
        start_pos.x = 0
      }

      if (start_pos.y == 0) {
        start_pos.y = 49
      }
      else if (start_pos.y == 49) {
        start_pos.y = 0
      }

      const road_positions: RoomPosition[] = path.map((p) => {
        return new RoomPosition(p.x, p.y, from_room.name)
      })

      const cost_matrix = room.remote_layout(start_pos.x, start_pos.y)
      if (!cost_matrix) {
        console.log(`Room.add_remote_harvester cannot create cost matrix ${room_link(room.name)}, start pos: (${start_pos.x}, ${start_pos.y})`)
        return null
      }

      const road_cost = 1
      const room_size = 50

      for (let i = 0; i < room_size; i++) {
        for (let j = 0; j < room_size; j++) {
          const cost = cost_matrix.get(i, j)

          if (cost > road_cost) {
            continue
          }

          road_positions.push(new RoomPosition(i, j, room.name))
        }
      }

      return road_positions
    // }
  }

  Room.prototype.show_weakest_walls = function(opts?:{max?: number}): void {
    opts = opts || {}

    const room = this as Room

    const wall_types: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
    const walls = room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        return wall_types.indexOf(structure.structureType) >= 0
      }
    }) as (StructureWall | StructureRampart)[]

    const sorted = walls.sort((lhs, rhs) => {
      if (lhs.hits > rhs.hits) return 1
      return -1
    })

    const max = opts.max || 10
    const colors: {[index: number]: string} = {
      0: '#ee2222',
      1: '#ee2222',
      2: '#ee2222',
      3: '#ee2222',
      4: '#eeee11',
      5: '#eeee11',
      6: '#eeee11',
      7: '#eeee11',
    }

    sorted.forEach((wall, index) => {
      if (index >= max) {
        return
      }

      const color = colors[index] || '#ffffff'

      room.visual.text(`${index}`, wall.pos, {
        color,
        align: 'center',
        font: '12px',
        opacity: 0.9,
      })
    })
  }

  Room.prototype.info = function(): void {
    const room = this as Room
    const room_memory = room.memory

    if (!room_memory) {
      console.log(`Room ${room_link(room.name)} has no RoomMemory`)
      return
    }

    if (room_memory.last_attacked_time) {
      const history_link = room_history_link(room.name, room_memory.last_attacked_time, {text: `${Game.time - room_memory.last_attacked_time} ticks ago`, color: 'red'})
      console.log(`Room ${room_link(room.name)}: last attacked at ${history_link}`)
    }
    else {
      console.log(`Room ${room_link(room.name)}: not attacked`)
    }
  }


  // ---
  RoomVisual.prototype.multipleLinedText = function(text: string | string[], x: number, y: number, style?: TextStyle): void {
    const show_visuals = Memory.debug.show_visuals
    if (!show_visuals || (show_visuals != this.roomName)) {
      return
    }

    const lines = ((text as string).split) ? (text as string).split('\n') : text as string[]
    lines.forEach((line, index) => {
      this.text(line, x, y + index, style)
    })
  }

  for (const room_name in Game.rooms) {
    const room = Game.rooms[room_name]
    room.spawns = []
  }
}

function create_cost_matrix_for(room: Room): CostMatrix {
  console.log(`${room_link(room.name)} create costmatrix`)

  let error_message: string | undefined

  let cost_matrix: CostMatrix = new PathFinder.CostMatrix;
  const margin = 5
  const room_size = 50

  const road_cost = 1
  const plain_cost = 2
  const swamp_cost = plain_cost * 5
  const unwalkable_cost = 255

  const hostile_cost = 12
  const edge_hostile_cost = 3
  const near_edge_hostile_cost = 5

  const is_edge = (x: number, y: number) => {
    if ((x == 0) || (x == 49)) {
      return true
    }
    if ((y == 0) || (y == 49)) {
      return true
    }
    return false
  }

  const is_near_edge = (x: number, y: number) => {
    if ((x == 1) || (x == 48)) {
      return true
    }
    if ((y == 1) || (y == 48)) {
      return true
    }
    return false
  }

  const terrains: Terrain[][] = []

  for (let i = 0; i < room_size; i++) {
    terrains.push([])

    for (let j = 0; j < room_size; j++) {
      const terrain = Game.map.getTerrainAt(i, j, room.name)
      let cost: number
      terrains[i].push(terrain)

      switch (terrain) {
        case 'plain':
          cost = plain_cost
          break

        case 'swamp':
          cost = swamp_cost
          break

        case 'wall':
          cost = unwalkable_cost
          break

        default: {
          cost = unwalkable_cost
          const message = `\n${room.name} ${i},${j} unknown terrain`
          error_message = !(!error_message) ? (error_message + message) : message
          break
        }
      }

      cost_matrix.set(i, j, cost)
    }
  }

  room.find(FIND_STRUCTURES).filter((structure: Structure) => {
    return structure.structureType == STRUCTURE_ROAD
  }).forEach((structure: Structure) => {
    cost_matrix.set(structure.pos.x, structure.pos.y, road_cost)
  })

  const set_hostile_cost = (obj: {pos: RoomPosition}) => {
    for (let i = (obj.pos.x - margin); i <= (obj.pos.x + margin); i++) {
      if ((i < 0) || (i > 49)) {
        continue
      }

      for (let j = (obj.pos.y - margin); j <= (obj.pos.y + margin); j++) {
        if ((j < 0) || (j > 49)) {
          continue
        }
        if (cost_matrix.get(i, j) == unwalkable_cost) {
          continue
        }

        let cost = hostile_cost + (margin - obj.pos.getRangeTo(i, j))

        if (is_edge(i, j)) {
          cost = edge_hostile_cost
        }
        else if (is_near_edge(i, j)) {
          cost = near_edge_hostile_cost
        }

        const terrain = terrains[i][j]
        if (terrain) {
          if (terrain == 'swamp') {
            cost += 3
          }
        }
        else {
          console.log(`create_cost_matrix_for unexpectedly null terrain at (${i}, ${j}) ${room.name}`)
        }

        cost_matrix.set(i, j, cost)
      }
    }
  }

  room.find(FIND_STRUCTURES).filter((structure: Structure) => {
    return structure.structureType == STRUCTURE_KEEPER_LAIR
  }).forEach(set_hostile_cost)

  room.find(FIND_SOURCES).forEach(set_hostile_cost)
  room.find(FIND_MINERALS).forEach(set_hostile_cost)

  if (error_message) {
    error_message = `Room.create_costmatrix error ${room.name}\n`

    console.log(error_message)
    Game.notify(error_message)
  }

  return cost_matrix
}

import { SquadMemory, SquadType } from "./squad/squad";
import { RegionMemory } from "./region"
import { ErrorMapper } from "ErrorMapper";
import { RemoteHarvesterSquadMemory } from './squad/remote_harvester';
import { UID, room_history_link, room_link, colored_resource_type, profile_link, colored_body_part } from "./utils";
import { RoomLayout, RoomLayoutOpts } from "./room_layout";
import { EmpireMemory } from './empire';

export interface AttackerInfo  {
  hostile_creeps: Creep[]
  hostile_teams: string[]
  attack: number
  ranged_attack: number
  heal: number
  work: number
  tough: number
}

const cost_matrixes = new Map<string, CostMatrix>()
console.log(`Initialize cost_matrixes`)

export type ChargeTarget = StructureExtension | StructureSpawn | StructureTower | StructureTerminal | StructureLab | StructurePowerSpawn | StructureContainer

declare global {
  interface Game {
    version: string
    reactions: {[index: string]: {lhs: ResourceConstant, rhs: ResourceConstant}}
    squad_creeps: {[squad_name: string]: Creep[]}
    check_resources: (resource_type: ResourceConstant) => {[room_name: string]: number}
    check_resources_in: (room_name: string) => void
    check_all_resources: () => void
    check_boost_resources: () => void
    collect_resources: (resource_type: ResourceConstant, room_name: string, threshold?: number) => void
    info: (opts?:{sorted?: boolean}) => void
    reset_costmatrix: (room_name: string) => void
    reset_all_costmatrixes: () => void
    creep_positions: (squad_name: string) => void

    resource_transfer: (opts?: {reversed?: boolean, room?: string} | string) => void
    transfer_energy: (target_room_name: string, opts?: {stop?: boolean, notify?: boolean}) => void
    transfer_resource: (resource_type: ResourceConstant, target_room_name: string, opts?: {stop?: boolean, notify?: boolean, no_immediate_send?: boolean}) => void

    show_excluded_walls(room_name: string): void
    add_excluded_walls(room_name: string, x_min: number, x_max: number, y_min: number, y_max: number, opts?: {dry_run?: boolean, include_rampart?: boolean}): void

    build_remote_roads(squad_name: string, opts?: {dry_run?: boolean}): void

    test(energy: number): void
  }

  interface Memory {
    last_tick: number
    empires: {[name: string]: EmpireMemory}
    squads: {[index: string]: SquadMemory}
    temp_squads: SquadMemory[]
    debug_last_tick: any
    versions: string[]
    regions: {[index: string]: RegionMemory}
    cpu_usages: number[]
    trading: {stop: boolean}
    debug: {
      show_visuals: string | null,
      show_path: boolean,
      show_costmatrix: string | null,
      test_send_resources: boolean,
      cpu: {
        show_usage: boolean,
        threshold: number,
        stop_threshold: number,
      },
      test?: number[],
    }
  }

  interface RoomMemory {
    keeper_squad_name?: string
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
    attacked: boolean // @todo: change it to Creep[]
    heavyly_attacked: boolean
    resourceful_tombstones: Tombstone[]
    attacker_info: AttackerInfo
    is_keeperroom: boolean
    is_centerroom: boolean
    cost_matrix(): CostMatrix | undefined
    construction_sites?: ConstructionSite[]  // Only checked if controller.my is true
    owned_structures?: Map<StructureConstant, AnyOwnedStructure[]>
    owned_structures_not_found_error(structure_type: StructureConstant): void
    add_remote_harvester(owner_room_name: string, carrier_max: number, opts?: {dry_run?: boolean, memory_only?: boolean, no_flags_in_base?: boolean, no_memory?: boolean}): string | null
    remote_layout(x: number, y: number): CostMatrix | null
    layout(center: {x: number, y: number}, opts?: RoomLayoutOpts): RoomLayout | null
    test(from: Structure): void
    place_construction_sites(): void
    source_road_positions(from_position: RoomPosition): RoomPosition[] | null

    info(): void

    initialize(): void

    structures_needed_to_be_charged?: ChargeTarget[]
  }

  interface RoomVisual {
    multipleLinedText(text: string | string[], x: number, y: number, style?: TextStyle): void
  }

  interface CostMatrix {
    add_terrain(room: Room): void
    add_normal_structures(room: Room, opts?: {ignore_public_ramparts?: boolean}): void
    show(room: Room, opt?: {colors?: {[index: number]: string}}): void
  }
}

export function init() {
}

export function tick(): void {
  Game.check_resources = (resource_type: ResourceConstant) => {
    let resources: {[room_name: string]: number} = {}

    let details = ""
    let sum = 0
    const empty_rooms: string[] = []

    for (const room_name of Object.keys(Game.rooms)) {
      const room = Game.rooms[room_name]
      if (!room || !room.controller || !room.controller.my) {
        continue
      }

      let amount = 0

      if (room.terminal && room.terminal.my) {
        amount += room.terminal.store[resource_type] || 0
      }

      if (room.storage && room.storage.my) {
        amount += room.storage.store[resource_type] || 0
      }

      if (amount > 0) {
        const amount_text = (resource_type == RESOURCE_ENERGY) ? `${Math.floor(amount / 1000)}k` : `${amount}`
        details += `\n- ${room_link(room_name)}: ${amount_text}`
        sum += amount

        resources[room_name] = amount
      }
      else {
        empty_rooms.push(room_name)
      }
    }

    const empty_text = (empty_rooms.length == 0) ? '' : `\n- Empty: ${empty_rooms.map(r=>room_link(r))}`
    console.log(`Resource ${resource_type}: ${sum}${details}${empty_text}`)

    return resources
  }

  Game.check_resources_in = (room_name: string) => {
    const room = Game.rooms[room_name]
    if (!room || !room.controller || !room.controller.my) {
      console.log(`Game.check_resources_in not my room ${room_name}`)
      return
    }

    const t = !room.terminal ? 'none' : `${Math.ceil(_.sum(room.terminal.store) / 1000)}k`
    const s = !room.storage ? 'none' : `${Math.ceil(_.sum(room.storage.store) / 1000)}k`

    console.log(`Resources in ${room_link(room_name)}, t: ${t}, s: ${s}`)

    RESOURCES_ALL.forEach((r_type) => {
      const resource_type = r_type as ResourceConstant

      let terminal_text = 'none'
      let storage_text = 'none'

      let terminal_amount = 0
      let storage_amount = 0

      if (room.terminal && room.terminal.my) {
        terminal_amount = room.terminal.store[resource_type] || 0
        terminal_text = `${terminal_amount}`
      }
      if (room.storage && room.storage.my) {
        storage_amount = room.storage.store[resource_type] || 0

        if (storage_amount >= 1000) {
          storage_text = `${Math.round(storage_amount / 1000)}k`
        }
        else {
          storage_text = `${storage_amount}`
        }
      }

      const amount = terminal_amount + storage_amount

      if (amount == 0) {
        return
      }

      console.log(`${colored_resource_type(resource_type)}\t${amount},\tt: ${terminal_text},\ts: ${storage_text}`)
    })

    for (const r_type of RESOURCES_ALL) {
    }
  }

  Game.check_all_resources = () => {
    RESOURCES_ALL.forEach((resource_type) => {

      let amount = 0

      for (const room_name of Object.keys(Game.rooms)) {
        const room = Game.rooms[room_name]
        if (!room || !room.controller || !room.controller.my) {
          continue
        }

        if (room.terminal && room.terminal.my) {
          amount += room.terminal.store[resource_type] || 0
        }

        if (room.storage && room.storage.my) {
          amount += room.storage.store[resource_type] || 0
        }
      }

      console.log(`${colored_resource_type(resource_type)}: ${amount}`)
    })
  }

  Game.check_boost_resources = () => {
    [
      RESOURCE_CATALYZED_UTRIUM_ACID,
      RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
      RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
      RESOURCE_CATALYZED_ZYNTHIUM_ACID,
      RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
      RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
    ].forEach((resource_type) => {

      let amount = 0

      for (const room_name of Object.keys(Game.rooms)) {
        const room = Game.rooms[room_name]
        if (!room || !room.controller || !room.controller.my) {
          continue
        }

        if (room.terminal && room.terminal.my) {
          amount += room.terminal.store[resource_type] || 0
        }

        if (room.storage && room.storage.my) {
          amount += room.storage.store[resource_type] || 0
        }
      }

      console.log(`${resource_type}: ${amount}`)
    })
  }

  Game.collect_resources = (resource_type: ResourceConstant, room_name: string, threshold?: number) => {
    threshold = threshold || 5000

    const target_room = Game.rooms[room_name]
    if (!target_room || !target_room.terminal || !target_room.terminal.my || (_.sum(target_room.terminal.store) > (target_room.terminal.storeCapacity * 0.8))) {
      console.log(`Game.collect_resources failed: ${room_name} not found`)
      return
    }

    let details = ""
    let sum = 0

    for (const name of Object.keys(Game.rooms)) {
      if (name == room_name) {
        continue
      }

      const room = Game.rooms[name]
      if (!room || !room.terminal || !room.terminal.my) {
        continue
      }

      const amount = room.terminal.store[resource_type] || 0
      if ((amount < 100) || (threshold && (amount > threshold))) {
        details += `\n${name}: ${amount}`
        continue
      }

      details += `\n${name}: ${amount}`

      const result = room.terminal.send(resource_type, amount, room_name)
      if (result == OK) {
        details += ` - ${amount}`
        sum += amount
      }
      else {
        console.log(`Game.collect_resources send failed with ${result}: from ${name} to ${room_name}, (${resource_type}, ${amount}, ${room_name})`)
        details += `  E${result}`
      }
    }

    console.log(`Collect resource ${resource_type} ${room_name}: ${target_room.terminal.store[resource_type] || 0} + ${sum}${details}`)
  }

  Game.info = (opts?:{sorted?: boolean}) => {
    opts = opts || {}

    let gcl_farm_info: string[] = []

    const info = 'info'
    const warn = 'warn'
    const error = 'error'
    const high = 'high'
    const almost = 'almost'

    const colors: {[index: string]: string} = {
      info: 'white',
      warn: '#F9E79F',
      error: '#E74C3C',
      high: '#64C3F9',
      almost: '#47CAB0',
    }

    const colored_text = (text: string, label: 'info' | 'warn' | 'error' | 'high' | 'almost') => {
      const color = colors[label] || 'white'
      return `<span style='color:${color}'>${text}</span>`
    }

    const gcl_progress = Math.round(Game.gcl.progress / 1000000)
    const gcl_progress_total = Math.round(Game.gcl.progressTotal / 1000000)
    const gcl_progress_percentage = Math.round((Game.gcl.progress / Game.gcl.progressTotal) * 1000) / 10

    let gcl_label: 'info' | 'high' | 'almost' = info
    if (gcl_progress_percentage > 90) {
      gcl_label = almost
    } else if (gcl_progress_percentage > 80) {
      gcl_label = high
    }

    const gcl_progress_text = colored_text(`${gcl_progress_percentage}`, gcl_label)

    console.log(`GCL: <b>${Game.gcl.level}</b>, <b>${gcl_progress}</b>M/<b>${gcl_progress_total}</b>M, <b>${gcl_progress_text}</b>%`)

    let rooms: Room[] = []

    for (const room_name of Object.keys(Game.rooms)) {
      const room = Game.rooms[room_name]
      if (!room || !room.controller || !room.controller.my) {
        continue
      }
      rooms.push(room)
    }

    if (opts.sorted) {
      rooms = rooms.sort((lhs, rhs) => {
        if (lhs.controller!.level > rhs.controller!.level) return 1
        if (lhs.controller!.level < rhs.controller!.level) return -1
        return 0
      })
    }

    console.log(`- Base:`)

    rooms.forEach((room) => {

      const room_name = room.name
      const controller = room.controller!
      const rcl = controller.level
      const progress_percentage = Math.round((controller.progress / controller.progressTotal) * 1000) / 10

      let progress_label: 'info' | 'high' | 'almost' = info
      if (progress_percentage > 90) {
        progress_label = almost
      } else if (progress_percentage > 80) {
        progress_label = high
      }

      const progress_text = colored_text(`${progress_percentage}`, progress_label)
      const progress = (rcl >= 8) ? 'Max' : `<b>${progress_text}</b> %`

      let rcl_level: 'info' | 'high' | 'almost' = info
      if (rcl == 8) {
      }
      else if (rcl >= 7) {
        rcl_level = almost
      }
      else {
        rcl_level = high
      }

      const rcl_text = colored_text(`${rcl}`, rcl_level)

      const region_memory = Memory.regions[room_name] as RegionMemory | undefined // Assuming region.name == region.room.name
      let reaction_output: string
      let number_of_reactions = ''

      if (rcl < 6) {
        reaction_output = '-'
      }
      else if (!region_memory || !region_memory.reaction_outputs || !region_memory.reaction_outputs[0]) {
        reaction_output = `<span style='color:${colors[warn]}'>none</span>`
      }
      else {
        const color = region_memory.no_reaction ? error : info
        reaction_output = colored_text(region_memory.reaction_outputs[0], color)

        if (region_memory.reaction_outputs.length > 1) {
          number_of_reactions = `(${region_memory.reaction_outputs.length}`
        }
      }

      let storage_amount_text: string

      if (room.storage) {
        const storage_amount = Math.round((_.sum(room.storage.store) / room.storage.storeCapacity) * 100)
        let storage_amount_level: 'info' | 'warn' | 'error' = info

        if (storage_amount > 90) {
          storage_amount_level = error
        } else if (storage_amount > 80) {
          storage_amount_level = warn
        }

        storage_amount_text = colored_text(`${storage_amount}`, storage_amount_level) + '%'
      }
      else {
        storage_amount_text = ""
      }

      const energy_amount = !room.storage ? 0 : Math.round(room.storage.store.energy / 1000)  // k energy
      const energy_amount_text = `${energy_amount}`
      let energy_amount_level: 'error' | 'warn' | 'info' | 'high' | 'almost' = info

      if (energy_amount < 100) {
        energy_amount_level = error
      }
      else if (energy_amount < 200) {
        energy_amount_level = warn
      }
      else if (energy_amount > 400) {
        energy_amount_level = high
      }
      else if (energy_amount > 600) {
        energy_amount_level = almost
      }

      const storage_capacity = !room.storage ? "" : ` <b>${colored_text(energy_amount_text, energy_amount_level)}</b>kE`

      let spawn_busy_time = 0
      let spawn_time = 0

      room.spawns.forEach((spawn) => {
        spawn_busy_time += spawn.memory.spawning.filter(s=>s).length
        spawn_time += 1000
      })

      const spawn_usage = Math.round((spawn_busy_time / spawn_time) * 100)
      let spawn_log_level: 'info' | 'warn' | 'error'

      if (spawn_usage > 90) {
        spawn_log_level = 'error'
      }
      else if (spawn_usage > 75) {
        spawn_log_level = 'warn'
      }
      else {
        spawn_log_level = 'info'
      }

      const spawn = `Spawn usage ${colored_text(spawn_usage.toString(10), spawn_log_level)} % (${room.spawns.length})`

      let heavyly_attacked = ''
      if (region_memory && region_memory.last_heavy_attacker) {
        const ticks = region_memory.last_heavy_attacker.ticks
        const ticks_ago = Game.time - ticks
        let ticks_ago_level: 'info' | 'warn' | 'error' = 'info'

        if (ticks_ago < 2000) {
          ticks_ago_level = 'error'
        }
        else if (ticks_ago < 8000) {
          ticks_ago_level = 'warn'
        }

        const text = colored_text(`${ticks_ago} ticks ago`, ticks_ago_level)
        const teams = !(!region_memory.last_heavy_attacker.teams) ? `, from ${region_memory.last_heavy_attacker.teams.map(t=>profile_link(t))}` : ''

        heavyly_attacked = `heavyly attacked ${room_history_link(room_name, ticks, {text})}${teams}`
      }

      const message = `  - ${room_link(room_name)}\tRCL:<b>${rcl_text}</b>  <b>${progress}</b>\t${reaction_output}${number_of_reactions}\t${spawn}\tStorage: ${storage_amount_text}\t${storage_capacity}\t${heavyly_attacked}`

      if (room.memory && room.memory.is_gcl_farm) {
        gcl_farm_info.push(message)
      }
      else {
        console.log(message)
      }
    })

    if (gcl_farm_info.length > 0) {
      console.log(`- GCL Farm:`)
    }

    gcl_farm_info.forEach(i => {
      console.log(i)
    })
  }

  Game.resource_transfer = (opts?: {reversed?: boolean, room?: string} | string) => {
    opts = opts || {}
    let resources: {[room_name: string]: {[room_name: string]: ResourceConstant[]}} = {}

    let target_room_name: string | undefined
    let reversed: boolean = false

    if (opts) {
      if (typeof(opts) === 'string') {
        target_room_name = opts
      }
      else {
        target_room_name = opts.room
        reversed = opts.reversed || false
      }
    }

    const room_info = target_room_name ? ` ${target_room_name}` : ''
    const detail = reversed ? ' (reversed)' : ''
    console.log(`Resource transfer${room_info}${detail}:`)

    const no_transfer_rooms: string[] = []

    for (const room_name of Object.keys(Game.rooms)) {
      const room = Game.rooms[room_name]
      if (!room || !room.controller || !room.controller.my) {
        continue
      }

      const region_memory = Memory.regions[room.name]
      if (!region_memory || !region_memory.resource_transports) {
        // console.log(` - ${room.name}: none`)
        if (reversed) {
          no_transfer_rooms.push(room_name)
        }
        continue
      }

      if (!reversed) {
        for (const destination_room_name in region_memory.resource_transports) {
          if (!resources[destination_room_name]) {
            resources[destination_room_name] = {}
          }
          resources[destination_room_name][room.name] = region_memory.resource_transports[destination_room_name]
        }
      }
      else if (!target_room_name || (target_room_name == room.name)) {
        console.log(` - ${room_link(room.name)}:`)

        for (const destination_room_name in region_memory.resource_transports) {
          const resources = region_memory.resource_transports[destination_room_name]
          if (!resources || (resources.length == 0)) {
            continue
          }
          console.log(`   ->${destination_room_name}: ${resources}`)
        }
      }
    }

    if (!reversed) {
      for (const room_name in resources) {
        if (target_room_name && (target_room_name != room_name)) {
          continue
        }

        console.log(` - ${room_link(room_name)}:`)

        if (!resources[room_name]) {
          no_transfer_rooms.push(room_name)
        }

        let receiving = false

        for (const from_room_name in resources[room_name]) {
          const r = resources[room_name][from_room_name]
          if (r && (r.length > 0)) {
            receiving = true
            console.log(`   <-${from_room_name}: ${r}`)
          }
        }

        if (!receiving) {
          no_transfer_rooms.push(room_name)
        }
      }
    }

    if (!target_room_name) {
      console.log(` - None: ${no_transfer_rooms}`)
    }
  }

  Game.transfer_energy = (target_room_name: string, opts?: {stop?: boolean, notify?: boolean}) => {
    return Game.transfer_resource(RESOURCE_ENERGY, target_room_name, opts)
  }

  Game.transfer_resource = (resource_type: ResourceConstant, target_room_name: string, opts?: {stop?: boolean, notify?: boolean, no_immediate_send?: boolean}) => {
    // if (!Game.rooms[target_room_name]) {
    //   console.log(`Game.transfer_resource wrong room name ${target_room_name}`)
    //   return
    // }
    if (RESOURCES_ALL.indexOf(resource_type) < 0) {
      console.log(`Game.transfer_resource wrong resource type ${resource_type}`)
      return
    }

    opts = opts || {}

    const stop_text = opts.stop ? '(Stop) ' : ''
    console.log(`${stop_text}Transfer ${resource_type}: ${room_link(target_room_name)}`)

    if (opts.stop) {
      for (const region_name in Memory.regions) {
        if (region_name == target_room_name) {
          continue
        }

        const region_memory = Memory.regions[region_name]
        if (!region_memory || !region_memory.resource_transports) {
          continue
        }

        const transfer = region_memory.resource_transports[target_room_name]
        if (!transfer) {
          continue
        }

        const index = transfer.indexOf(resource_type)
        if (index < 0) {
          continue
        }

        transfer.splice(index, 1)
        console.log(`- ${region_name}`)

        if (transfer.length == 0) {
          delete region_memory.resource_transports[target_room_name]
        }
      }
    }
    else {
      const energy_source_regions: string[] = [
        'W43S5',
        'W44S7',
        'W45S27',
        'W46S3',
        'W47S6',
        'W48S6',
        'W47S9',
        'W56S7',
        'W55S13',
        'W55S23',
        'W51S29',
      ]

      for (const region_name in Memory.regions) {
        if (region_name == target_room_name) {
          continue
        }

        if (resource_type == RESOURCE_ENERGY) {
          if (energy_source_regions.indexOf(region_name) < 0) {
            continue
          }
        }

        const region_memory = Memory.regions[region_name]
        const room = Game.rooms[region_name]
        if (!region_memory || !region_memory.resource_transports || !room || !room.terminal || !room.storage) {
          continue
        }

        const resource_amount = (room.terminal.store[resource_type] || 0) + (room.storage.store[resource_type] || 0)
        if (resource_amount < 4000) {
          continue
        }

        const transfer = region_memory.resource_transports[target_room_name]
        if (transfer) {
          if (transfer.indexOf(resource_type) >= 0) {
            continue
          }
          transfer.push(resource_type)
        }
        else {
          region_memory.resource_transports[target_room_name] = [resource_type]
        }
        console.log(`- ${region_name}`)
      }

      if (!opts.no_immediate_send) {
        Memory.debug.test_send_resources = true
      }
    }

    console.log(`---`)

    Game.resource_transfer(target_room_name)

    if (opts.notify) {
      const stop_text: string = !(!opts.stop) ? ' stop' : ''
      Game.notify(`Game.transfer_resource ${resource_type}, ${target_room_name}${stop_text}`)
    }
  }


  Game.reset_costmatrix = (room_name: string) => {
    ErrorMapper.wrapLoop(() => {
      console.log(`RESET costmatrix for ${room_name}`)

      const room_memory = Memory.rooms[room_name]

      if (!room_memory) {
        console.log(`Reset costmatrix no room memory for ${room_name}: probably writing wrong code`)
        return
      }

      Memory.rooms[room_name].cost_matrix = undefined
      cost_matrixes.delete(room_name)

    }, `Game.reset_costmatrix for ${room_name}`)()
  }

  Game.reset_all_costmatrixes = () => {
    ErrorMapper.wrapLoop(() => {
      console.log(`RESET ALL costmatrixes`)

      for (const room_name in Memory.rooms) {
        const room_memory = Memory.rooms[room_name]

        if (!room_memory) {
          console.log(`Reset costmatrix no room memory for ${room_name}: probably writing wrong code`)
          break
        }

        Memory.rooms[room_name].cost_matrix = undefined
        cost_matrixes.delete(room_name)
      }
    }, `Game.reset_all_costmatrix`)()
  }

  Game.creep_positions = (squad_name: string) => {
    console.log(`${squad_name}`)

    ErrorMapper.wrapLoop(() => {
      for (const creep_name in Game.creeps) {
        const creep = Game.creeps[creep_name]

        if (creep.memory.squad_name != squad_name) {
          continue
        }

        const spawning = creep.spawning ? ' (spawning)' : ''
        console.log(`Creep ${creep.name} ${creep.memory.type} at ${creep.pos} ${room_link(creep.pos.roomName)}${spawning}`)
      }
    }, `Game.creep_positions`)()
  }

  Game.show_excluded_walls = function(room_name: string): void {
    const room = Game.rooms[room_name]
    if (!room) {
      console.log(`Game.show_excluded_walls no room ${room_name}`)
      return
    }

    const region_memory = Memory.regions[room_name]
    if (!region_memory) {
      console.log(`Game.show_excluded_walls no region memory for ${room_name}`)
      return
    }

    if (!region_memory.excluded_walls || (region_memory.excluded_walls.length == 0)) {
      console.log(`No excluded walls in ${room_name}`)

      room.visual.text(`NO EXCLUDED WALLS`, 25, 25, {
        align: 'center',
        opacity: 1.0,
        font: '20px',
        color: '#ff0000',
      })
      return
    }

    region_memory.excluded_walls.forEach((id) => {
      const wall = Game.getObjectById(id) as StructureWall | StructureRampart | undefined
      if (!wall) {
        console.log(`Game.show_excluded_walls no wall ${id} in ${room_name}`)
        return
      }

      let sign = '■'

      if ([STRUCTURE_WALL, STRUCTURE_RAMPART].indexOf(wall.structureType) < 0) {
        console.log(`Game.show_excluded_walls not wall ${id} at ${wall.pos} in ${room_name}`)
        sign = '!!'
      }

      room.visual.text(sign, wall.pos, {
        align: 'center',
        opacity: 1.0,
        font: '12px',
        color: '#ff0000',
      })
    })
  }

  Game.add_excluded_walls = function(room_name: string, x_min: number, x_max: number, y_min: number, y_max: number, opts?: {dry_run?: boolean, include_rampart?: boolean}): void {
    const room = Game.rooms[room_name]
    if (!room) {
      console.log(`Game.add_excluded_walls no room ${room_name}`)
      return
    }

    const region_memory = Memory.regions[room_name]
    if (!region_memory) {
      console.log(`Game.add_excluded_walls no region memory for ${room_name}`)
      return
    }

    if (!region_memory.excluded_walls) {
      region_memory.excluded_walls = []
    }

    opts = opts || {}
    const dry_run = !(opts.dry_run == false)
    const added: StructureWall[] = []
    const includes: StructureConstant[] = opts.include_rampart ? [STRUCTURE_WALL, STRUCTURE_RAMPART] : [STRUCTURE_WALL]

    console.log(`Game.add_excluded_walls dry_run: ${dry_run}`)

    room.find(FIND_STRUCTURES, {
      filter: structure => {
        if (includes.indexOf(structure.structureType) < 0) {
          return false
        }
        if ((structure.pos.x < x_min) || (structure.pos.x > x_max)) {
          return false
        }
        if ((structure.pos.y < y_min) || (structure.pos.y > y_max)) {
          return false
        }
        return true
      }
    }).forEach(wall => {
      if (region_memory.excluded_walls!.indexOf(wall.id) < 0) {
        if (!dry_run) {
          added.push(wall as StructureWall)
        }

        room.visual.text('■', wall.pos, {
          align: 'center',
          opacity: 1.0,
          font: '12px',
          color: '#ff0000',
        })
      }
    })

    if (!dry_run) {
      if (added.length > 0) {
        console.log(`Added:`)
        added.forEach(wall => {
          region_memory.excluded_walls!.push(wall.id)
          console.log(`${wall.id} at ${wall.pos} ${wall.structureType}`)
        })
      }
      else {
        console.log(`No walls added`)
      }
    }
  }

  Game.build_remote_roads = (squad_name: string, opts?: {dry_run?: boolean}) => {
    opts = opts || {}
    const dry_run = !(opts.dry_run == false)

    const squad_memory = Memory.squads[squad_name] as RemoteHarvesterSquadMemory
    if (!squad_memory) {
      console.log(`Game.build_remote_roads no squad named ${squad_name}`)
      return
    }
    if (squad_memory.type != SquadType.REMOET_HARVESTER) {
      console.log(`Game.build_remote_roads not remote harvester: ${squad_name}`)
      return
    }

    const target_room = Game.rooms[squad_memory.room_name]
    if (!target_room) {
      console.log(`Game.build_remote_roads no target room ${squad_memory.room_name}, ${squad_name}`)
      return
    }

    const owner_room = Game.rooms[squad_memory.owner_name]
    if (!owner_room || !owner_room.storage || !owner_room.storage.my) {
      console.log(`Game.build_remote_roads no owner room or storage ${squad_memory.owner_name}, ${squad_name}`)
      return
    }

    const road_positions = target_room.source_road_positions(owner_room.storage.pos)
    if (!road_positions) {
      console.log(`Game.build_remote_roads no road positions: ${squad_name}`)
      return
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

      return
    }

    // --- Place Construnction Sites
    const time = Game.time

    road_positions.forEach((pos) => {
      const r = Game.rooms[pos.roomName]
      if (!r) {
        return
      }
      r.createConstructionSite(pos, STRUCTURE_ROAD)
    })
  }

  Game.test = function(energy: number): void {
    const move: BodyPartConstant[] = [MOVE]
    const work: BodyPartConstant[] = [WORK, WORK, WORK, WORK]
    const energy_unit = 500

    let body: BodyPartConstant[] = []

    let number_of_units = 0

    while (energy >= energy_unit) {
      body = move.concat(body)
      body = body.concat(work)

      energy -= energy_unit
      number_of_units += 1
    }

    const number_of_carries = Math.ceil((number_of_units * 4.0) / 9.0)

    for (let i = 0; i < number_of_carries; i++) {
      body.push(CARRY)
    }

    console.log(`TEST:\n${body.map(b=>colored_body_part(b))}`)
  }

  // --- Room
  Room.prototype.initialize = function() {
    let room_memory: RoomMemory | undefined = Memory.rooms[this.name] as RoomMemory | undefined

    if (!room_memory) {
      room_memory = {
        harvesting_source_ids: [],
      }
      Memory.rooms[this.name] = room_memory
    }

    this.sources = this.find(FIND_SOURCES)

    const attacker_info: AttackerInfo = {
      hostile_creeps: [],
      hostile_teams: [],
      attack: 0,
      ranged_attack: 0,
      heal: 0,
      work: 0,
      tough: 0,
    }

    attacker_info.hostile_creeps = this.find(FIND_HOSTILE_CREEPS)

    attacker_info.hostile_creeps.forEach((creep: Creep) => {
      if (attacker_info.hostile_teams.indexOf(creep.owner.username) < 0) {
        attacker_info.hostile_teams.push(creep.owner.username)
      }

      attacker_info.attack = creep.getActiveBodyparts(ATTACK)
      attacker_info.ranged_attack = creep.getActiveBodyparts(RANGED_ATTACK)
      attacker_info.heal = creep.getActiveBodyparts(HEAL)
      attacker_info.work = creep.getActiveBodyparts(WORK)
      attacker_info.tough = creep.getActiveBodyparts(TOUGH)
    })
    this.attacker_info = attacker_info

    if (this.attacker_info.hostile_creeps.length > 0) {
      (Memory.rooms[this.name] as RoomMemory).last_attacked_time = (Memory.rooms[this.name] as RoomMemory).attacked_time;
      (Memory.rooms[this.name] as RoomMemory).attacked_time = Game.time;
    }
    else {
      (Memory.rooms[this.name] as RoomMemory).attacked_time = undefined
    }

    const hostiles: Creep[] = this.find(FIND_HOSTILE_CREEPS, {
      // filter: function(creep: Creep): boolean {
      //   if (creep.pos.x == 0) {
      //     return false
      //   }
      //   if (creep.pos.x == 49) {
      //     return false
      //   }
      //   if (creep.pos.y == 0) {
      //     return false
      //   }
      //   if (creep.pos.y == 49) {
      //     return false
      //   }

      //   const attack_parts = creep.getActiveBodyparts(ATTACK) + creep.getActiveBodyparts(RANGED_ATTACK)
      //   return attack_parts > 0
      // }
    })

    this.attacked = hostiles.length > 0

    let number_of_attacks = 0

    hostiles.forEach((creep: Creep) => {
      number_of_attacks += (creep.getActiveBodyparts(ATTACK) * 3) + creep.getActiveBodyparts(RANGED_ATTACK) + creep.getActiveBodyparts(HEAL)
    })
    this.heavyly_attacked = number_of_attacks > 16

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

    let cost_matrix: CostMatrix | undefined = cost_matrixes.get(this.name)
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
        cost_matrixes.set(this.name, cost_matrix)
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
    cost_matrixes.set(this.name, cost_matrix)

    return cost_matrix
  }

  Room.prototype.owned_structures_not_found_error = function(structure_type: StructureConstant): void {
    console.log(`Room.owned_structures_not_found_error ${structure_type} ${room_link(this.name)}`)
  }

  Room.prototype.add_remote_harvester = function(owner_room_name: string, carrier_max: number, opts?: {dry_run?: boolean, memory_only?: boolean, no_flags_in_base?: boolean, no_memory?: boolean}): string | null {
    opts = opts || {}
    const dry_run = !(opts.dry_run == false)
    const no_flags_in_base = !(!opts.no_flags_in_base)
    const no_memory = !(!opts.no_memory)
    console.log(`Room.add_remote_harvester dry_run: ${dry_run}`)

    const room = this as Room
    const room_name = room.name

    const owner_room = Game.rooms[owner_room_name]
    if (!owner_room) {
      console.log(`Room.add_remote_harvester no destination room ${owner_room_name}, ${room.name}`)
      return null
    }
    if (!owner_room.storage || !owner_room.storage.my) {
      console.log(`Room.add_remote_harvester no storage in room ${owner_room_name}`)
      return null
    }
    if (!room.sources || (room.sources.length == 0)) {
      console.log(`Room.add_remote_harvester no sources in room ${room.name}, ${room.sources}`)
      return null
    }

    if (!opts.memory_only) {
      // --- Path
      const road_positions = room.source_road_positions(owner_room.storage.pos)
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
      // --- Squad Memory
      let squad_name = `remote_harvester_${room.name.toLowerCase()}`

      while (Memory.squads[squad_name]) {
        squad_name = `${squad_name}_1`
      }

      const sources: {[index: string]: {container_id?: string}} = {}

      room.find(FIND_SOURCES).forEach((source) => {
        sources[source.id] = {}
      })

      const squad_memory: RemoteHarvesterSquadMemory = {
        name: squad_name,
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

      Memory.squads[squad_name] = squad_memory

      // Region Memory
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

      return squad_name
    }
    return null
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

  Room.prototype.layout = function(center: {x: number, y: number}, opts?: RoomLayoutOpts): RoomLayout | null {
    const room = this as Room

    try {
      const layout = new RoomLayout(room, center)
      return layout

    } catch(e) {
      console.log(e)
      return null
    }
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
    const room = this

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

      const result = room.createConstructionSite(flag.pos, structure_type)

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
      else if (result != ERR_RCL_NOT_ENOUGH) {
        console.log(`ERROR Place ${structure_type} construction site failed E${result}: ${flag.name}, ${flag.pos}, ${flag.color}, ${room_link(flag.pos.roomName)}`)
      }
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

  PathFinder.CostMatrix.prototype.add_terrain = function(room: Room): void {
    if (!room) {
      console.log(`CostMatrix.add_terrain room cannot be nil`)
      return
    }

    let error_message: string | undefined

    const cost_matrix = this as CostMatrix
    const room_size = 50

    const road_cost = 1
    const plain_cost = 2
    const swamp_cost = plain_cost * 5
    const unwalkable_cost = 255

    for (let i = 0; i < room_size; i++) {
      for (let j = 0; j < room_size; j++) {
        const terrain = Game.map.getTerrainAt(i, j, room.name)
        let cost: number

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

    if (error_message) {
      error_message = `Room.create_costmatrix error ${room.name}\n`

      console.log(error_message)
    }
  }

  PathFinder.CostMatrix.prototype.add_normal_structures = function(room: Room, opts?: {ignore_public_ramparts?: boolean}): void {
    if (!room) {
      console.log(`CostMatrix.add_normal_structures room cannot be nil`)
      return
    }

    const options = opts || {}

    const cost_matrix = this as CostMatrix
    const unwalkable_cost = 255

    const walkable_structure_types: StructureConstant[] = [
      STRUCTURE_ROAD,
      STRUCTURE_CONTAINER,
    ]

    room.find(FIND_STRUCTURES, {
      filter: (structure) => {
        if (walkable_structure_types.indexOf(structure.structureType) >= 0) {
          return false
        }
        if (structure.structureType == STRUCTURE_RAMPART) {
          if (structure.my) {
            return false
          }
          if (structure.isPublic && options.ignore_public_ramparts) {
            return false
          }
          return true
        }
        return true
      }
    }).forEach((structure) => {
      cost_matrix.set(structure.pos.x, structure.pos.y, unwalkable_cost)
    })
  }

  PathFinder.CostMatrix.prototype.show = function(room: Room, opt?: {colors?: {[index: number]: string}}): void {
    opt = opt || {}
    const colors: {[index: number]: string} = opt.colors || {}

    if (!room) {
      console.log(`CostMatrix.show room cannot be nil`)
      return
    }

    const cost_matrix = this as CostMatrix
    const room_size = 50

    for (let i = 0; i < room_size; i++) {
      for (let j = 0; j < room_size; j++) {
        const cost = cost_matrix.get(i, j)
        const color = colors[cost] || '#ffffff'

        room.visual.text(`${cost}`, i, j, {
          color,
          align: 'center',
          font: '12px',
          opacity: 0.8,
        })
      }
    }
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

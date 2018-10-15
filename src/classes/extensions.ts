import { SquadMemory, SquadType } from "./squad/squad"
import { RegionMemory } from "./region"
import { ErrorMapper } from "utils/ErrorMapper"
import { RemoteHarvesterSquadMemory } from './squad/remote_harvester'
import { room_history_link, room_link, colored_resource_type, profile_link, colored_body_part, leveled_colored_text, ColorLevel, leveled_color } from './utils';
import { EmpireMemory } from './empire'
import { ActionResult } from "./creep"
import { populateLOANlist } from "./loanUserList"

const cost_matrixes = new Map<string, CostMatrix>()
console.log(`Initialize cost_matrixes`)

declare global {
  interface Game {
    version: string
    reactions: {[index: string]: {lhs: ResourceConstant, rhs: ResourceConstant}}  // Used in init.ts
    squad_creeps: {[squad_name: string]: Creep[]}

    check_resources: (resource_type: ResourceConstant) => {[room_name: string]: number}
    check_resource_amount: (resource_type: ResourceConstant) => number
    check_resources_in: (room_name: string) => void
    check_all_resources: () => void
    collect_resources: (resource_type: ResourceConstant, room_name: string, threshold?: number) => void
    send_resource: (from: string[], to: string, resource_type: ResourceConstant, amount: number) => ActionResult

    info: (opts?:{sorted?: boolean}) => void
    creep_positions: (squad_name: string) => void
    last_attacked_rooms: (opts?: {last?: number}) => void

    get_costmatrix: (room_name: string) => CostMatrix | undefined
    set_costmatrix: (room_name: string, costmatrix: CostMatrix) => void
    reset_costmatrix: (room_name: string) => void
    reset_all_costmatrixes: () => void

    resource_transfer: (opts?: {reversed?: boolean, room?: string} | string) => void
    transfer_energy: (target_room_name: string, opts?: {stop?: boolean, notify?: boolean}) => void
    transfer_resource: (resource_type: ResourceConstant, target_room_name: string, opts?: {stop?: boolean, notify?: boolean, no_immediate_send?: boolean}) => void

    show_excluded_walls(room_name: string): void
    add_excluded_walls(room_name: string, x_min: number, x_max: number, y_min: number, y_max: number, opts?: {dry_run?: boolean, include_rampart?: boolean}): void

    build_remote_roads(squad_name: string, opts?: {dry_run?: boolean}): void

    test(energy: number): void
    dump_memory(): void // @todo:
    refresh_room_memory(opts?:{dry_run?: boolean}): void

    LOANlist: string[]
    populateLOANlist(): void
    isEnemy(creep: Creep): boolean
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
    cpu: {
      last_bucket: number
    }
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
        let amount_level: 'info' | 'high' | 'almost' = 'info'

        if (amount > 100000) {
          amount_level = 'almost'
        }
        else if (amount > 40000) {
          amount_level = 'high'
        }

        details += `\n- ${room_link(room_name)}: ${leveled_colored_text(amount_text, amount_level)}`
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

  Game.check_resource_amount = (resource_type: ResourceConstant) => {
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

    return amount
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

  Game.send_resource = (from: string[], to: string, resource_type: ResourceConstant, amount: number) => {
    let done = false

    for (const room_name of from) {
      if (room_name == to) {
        continue
      }

      const room = Game.rooms[room_name]
      if (!room || !room.controller || !room.controller.my) {
        console.log(`Game.send_resource unexpected room ${room}, ${room_name}`)
        continue
      }
      if (!room.terminal || (room.terminal.cooldown != 0) || ((room.terminal.store[resource_type] || 0) < amount)) {
        continue
      }

      const result = room.terminal.send(resource_type, amount, to)
      console.log(`Game.send_resource ${resource_type} * ${amount} from ${room_link(room_name)} to ${room_link(to)}, result: ${result}`)

      if (result != OK) {
        continue
      }
      done = true
      break
    }

    if (!done) {
      console.log(`Game.send_resource no ${resource_type} * ${amount} in ${from}`)
      return ActionResult.IN_PROGRESS
    }
    return ActionResult.DONE
  }

  Game.info = (opts?:{sorted?: boolean}) => {
    opts = opts || {}

    let gcl_farm_info: string[] = []

    const info = 'info'
    const warn = 'warn'
    const error = 'critical'
    const high = 'high'
    const almost = 'almost'

    const gcl_progress = Math.round(Game.gcl.progress / 1000000)
    const gcl_progress_total = Math.round(Game.gcl.progressTotal / 1000000)
    const gcl_progress_percentage = Math.round((Game.gcl.progress / Game.gcl.progressTotal) * 1000) / 10

    let gcl_label: 'info' | 'high' | 'almost' = info
    if (gcl_progress_percentage > 90) {
      gcl_label = almost
    } else if (gcl_progress_percentage > 80) {
      gcl_label = high
    }

    const gcl_progress_text = leveled_colored_text(`${gcl_progress_percentage}`, gcl_label)

    console.log(`v${Game.version}, GCL: <b>${Game.gcl.level}</b>, <b>${gcl_progress}</b>M/<b>${gcl_progress_total}</b>M, <b>${gcl_progress_text}</b>%`)

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

      const progress_text = leveled_colored_text(`${progress_percentage}`, progress_label)
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

      const rcl_text = leveled_colored_text(`${rcl}`, rcl_level)

      const region_memory = Memory.regions[room_name] as RegionMemory | undefined // Assuming region.name == region.room.name
      let reaction_output: string
      let number_of_reactions = ''

      if (rcl < 6) {
        reaction_output = '-'
      }
      else if (!region_memory || !region_memory.reaction_outputs || !region_memory.reaction_outputs[0]) {
        reaction_output = leveled_colored_text('none', warn)
      }
      else {
        const color = region_memory.no_reaction ? error : info
        reaction_output = leveled_colored_text(region_memory.reaction_outputs[0], color)

        if (region_memory.reaction_outputs.length > 1) {
          number_of_reactions = `(${region_memory.reaction_outputs.length}`
        }
      }

      let storage_amount_text: string

      if (room.storage) {
        const storage_amount = Math.round((_.sum(room.storage.store) / room.storage.storeCapacity) * 100)
        let storage_amount_level: 'info' | 'warn' | 'critical' = info

        if (storage_amount > 90) {
          storage_amount_level = error
        } else if (storage_amount > 80) {
          storage_amount_level = warn
        }

        storage_amount_text = leveled_colored_text(`${storage_amount}`, storage_amount_level) + '%'
      }
      else {
        storage_amount_text = ""
      }

      const energy_amount = !room.storage ? 0 : Math.round(room.storage.store.energy / 1000)  // k energy
      const energy_amount_text = `${energy_amount}`
      let energy_amount_level: 'critical' | 'warn' | 'info' | 'high' | 'almost' = info

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

      const storage_capacity = !room.storage ? "" : ` <b>${leveled_colored_text(energy_amount_text, energy_amount_level)}</b>kE`

      let spawn_busy_time = 0
      let spawn_time = 0

      room.spawns.forEach((spawn) => {
        spawn_busy_time += spawn.memory.spawning.filter(s=>s).length
        spawn_time += 1000
      })

      const spawn_usage = Math.round((spawn_busy_time / spawn_time) * 100)
      let spawn_log_level: 'info' | 'warn' | 'error'

      if ((spawn_usage > 90) || (spawn_usage < 5)) {
        spawn_log_level = 'error'
      }
      else if ((spawn_usage > 75) || (spawn_usage < 12)) {
        spawn_log_level = 'warn'
      }
      else {
        spawn_log_level = 'info'
      }

      const spawn = `Spawn usage ${leveled_colored_text(spawn_usage.toString(10), spawn_log_level)} % (${room.spawns.length})`

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

        const text = leveled_colored_text(`${ticks_ago} ticks ago`, ticks_ago_level)
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
        'W45S3',
        'W46S3',
        'W47S6',
        'W48S6',
        'W47S9',
        'W54S7',
        'W56S7',
        'W55S13',
        'W55S23',
        'W51S29',
        'W58S4',
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

  Game.get_costmatrix = (room_name: string) => {
    return cost_matrixes.get(room_name)
  }

  Game.set_costmatrix = (room_name: string, costmatrix: CostMatrix) => {
    cost_matrixes.set(room_name, costmatrix)
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

  Game.last_attacked_rooms = (opts?: {last?: number}) => {
    opts = opts || {}
    const last = opts.last || 2000
    const time = Game.time

    console.log(`Attacked rooms in ${last} ticks`)

    for (const room_name in Memory.rooms) {
      const room_memory = Memory.rooms[room_name]
      if (!room_memory) {
        continue
      }

      const attacked_time = room_memory.attacked_time || room_memory.last_attacked_time
      if (!attacked_time) {
        continue
      }

      const ticks_ago = time - attacked_time
      if (ticks_ago > last) {
        continue
      }

      const text = `${ticks_ago} ticks ago`

      let level: ColorLevel = 'info'
      const room = Game.rooms[room_name] as Room | undefined
      if (room && room.is_keeperroom) {
        continue
      }

      if (room && room.controller) {
        if (room.controller.my) {
          level = 'critical'
        }
        else if (room.controller.reservation && (room.controller.reservation.username == 'Mitsuyoshi')) {
          level = 'warn'
        }
      }

      console.log(`- ${room_link(room_name, {color: leveled_color(level)})} \tattacked: ${room_history_link(room_name, attacked_time, {text})}`)
    }

    console.log(`\n`)
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

  Game.refresh_room_memory = function(opts?:{dry_run?: boolean}): void {
    // Every rooms have room.memory and they should(for now)
    console.log(`Game.refresh_room_memory is not fully functional`)

    opts = opts || {}
    const dry_run = (opts.dry_run != false)

    console.log(`Refresh room memory:`)

    for (const room_name in Memory.rooms) {
      const room = Game.rooms[room_name]
      if (room) {
        continue
      }

      const room_memory = Memory.rooms[room_name]
      if (room_memory.ancestor || room_memory.exits || room_memory.is_gcl_farm) {
        continue
      }

      console.log(`- ${room_name}`)
    }
  }

  Game.populateLOANlist = function(): void {
    populateLOANlist()
  }

  Game.isEnemy = function(creep: Creep): boolean {
    // return Game.LOANlist.indexOf(creep.owner.username) < 0
    return true
  }


  // --- CostMatrix
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

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { init as extensionInit, tick as extensionTick } from "_old/extensions"
import { init as creepInit } from "_old/creep"
import { init as spawnInit } from "_old/spawn"
import { tick as roomTick } from "_old/room"
import { leveled_colored_text } from '../utility'
import { World } from "world_info/world_info"
import { SystemInfo } from "utility/system_info"
import { isV4CreepMemory } from "prototype/creep"

export function init(): void {
  const now = Game.time

  Memory.last_tick = now

  if (!Memory.versions) {
    Memory.versions = []
  }
  const version = SystemInfo.application.version
  if (Memory.versions.indexOf(version) < 0) {
    Memory.versions.push(version)
    console.log(`Updated v${version}`)
  }

  if (Memory.room_info == null) {
    Memory.room_info = {}
  }

  if (Memory.towers == null) {
    Memory.towers = {}
  }

  if (!Memory.empires) {
    Memory.empires = {}
  }

  if (Memory.squads == null) {
    Memory.squads = {}
  }

  if (Memory.rooms == null) {
    Memory.rooms = {}
  }

  if (Memory.sectors == null) {
    Memory.sectors = {}
  }

  if (!Memory.regions) {
    Memory.regions = {}
  }

  if (!Memory.cpu) {
    Memory.cpu = {
      last_bucket: Game.cpu.bucket
    }
  }

  if (!Memory.migrations) {
    Memory.migrations = {
      list: [],
    }
  }

  if (!Memory.debug) {
    Memory.debug = {
      show_visuals: null,
      show_path: false,
      show_costmatrix: null,
      test_send_resources: false,
      cpu: {
        show_usage: false,
        threshold: 0,
        stop_threshold: 150,
      }
    }
  }

  if (!Memory.cpu_usages) {
    Memory.cpu_usages = []
  }

  if (Memory.trading == null) {
    Memory.trading = {
      stop: true
    }
  }

  extensionInit()
}

export function tick(): void {
  const time = Game.time

  if ((time % 2099) == 0) {
    Memory.debug.show_visuals = null
    Memory.debug.show_path = false
  }

  if ((time % 97) == 29) {
    Memory.debug.show_costmatrix = null
  }

  const cpu_ticks = 20
  if (Memory.cpu_usages.length > cpu_ticks) {
    Memory.cpu_usages.shift()
  }

  const current_bucket = Game.cpu.bucket
  const diff = current_bucket - (Memory.cpu.last_bucket || 1000)
  if (((diff < -480) && (current_bucket < 9500)) || (current_bucket < 5000)) {
    const message = `CPU Bucket ${current_bucket} (was ${Memory.cpu.last_bucket})`
    console.log(leveled_colored_text(message, 'critical'))
    // Game.notify(message)
  }

  Memory.cpu.last_bucket = current_bucket

  if (((Game.time % cpu_ticks) === 0) && (World.isSimulation() !== true)) {
    const limit = Game.cpu.limit

    const info = 'info'
    const warn = 'warn'
    const error = 'error'
    const critical = 'critical'

    const critical_level = limit * 1.5
    const error_level = limit
    const warn_level = limit * 0.90

    const usage = Memory.cpu_usages.map(u => {
      let level: 'info' | 'warn' | 'error' | 'critical'

      if (u > critical_level) {
        level = critical
      }
      else if (u > error_level) {
        level = error
      }
      else if (u > warn_level) {
        level = warn
      }
      else {
        level = info
      }

      return leveled_colored_text(`${u}`, level)
    })

    // --
    const average = _.sum(Memory.cpu_usages) / cpu_ticks
    let average_level: 'info' | 'warn' | 'error' | 'critical'

    if (average > critical_level) {
      average_level = critical
    }
    else if (average > error_level) {
      average_level = error
    }
    else if (average > warn_level) {
      average_level = warn
    }
    else {
      average_level = info
    }

    const ave = leveled_colored_text(`${average}`, average_level)

    // --
    const bucket = Game.cpu.bucket
    let bucket_level: 'info' | 'warn' | 'error' | 'critical'

    if (bucket < 5000) {
      bucket_level = critical
    }
    else if (bucket < 7000) {
      bucket_level = error
    }
    else if (bucket < 9000) {
      bucket_level = warn
    }
    else {
      bucket_level = info
    }

    const b = leveled_colored_text(`${bucket}`, bucket_level)

    console.log(`CPU usage: ${usage}, ave: ${ave}, bucket: ${b} at ${Game.time}`)
  }

  Game.reactions = {}

  for (const resource_type of Object.keys(REACTIONS)) {
    const reactions = REACTIONS[resource_type]

    for (const ingredient_type of Object.keys(reactions)) {
      const compound_type = reactions[ingredient_type]
      Game.reactions[compound_type] = {
        lhs: resource_type as ResourceConstant,
        rhs: ingredient_type as ResourceConstant,
      }
    }
  }

  extensionTick()

  ErrorMapper.wrapLoop(() => {
    Game.populateLOANlist()
  }, `populateLOANlist`)()

  roomTick()

  for (const room_name in Game.rooms) {
    const room = Game.rooms[room_name]
    room.initialize()
  }

  // Followings set functions to prototype, and the prototypes are reset every tick
  spawnInit()
  creepInit()

  Game.squad_creeps = {}

  for (const creep_name in Game.creeps) {
    const creep = Game.creeps[creep_name]
    if (!isV4CreepMemory(creep.memory)) {
      continue
    }

    const squad_name = creep.memory.squad_name

    if (!squad_name) {
      continue
    }

    if (!Game.squad_creeps[squad_name]) {
      Game.squad_creeps[squad_name] = []
    }

    Game.squad_creeps[squad_name].push(creep)
  }
}

/**
 * Memory structure
 * root
 * |- game
 * |- empire
 * |- spawn(StructureSpawn.memory)
 * |  |- squad_names
 * |- squads
 * |  |- squad_name
 * |- creep(Creep.memory)
 *    |- squad_name
 */

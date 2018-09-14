import { init as extensionInit, tick as extensionTick } from "classes/extensions"
import { init as creepInit } from "classes/creep"
import { init as spawnInit } from "classes/spawn"
import { tick as roomTick } from "classes/room"

const version = '2.55.0'

export function init(): void {
  Game.version = version
  const now = Game.time

  Memory.last_tick = now

  if (!Memory.versions) {
    Memory.versions = []
  }
  if (Memory.versions.indexOf(Game.version) < 0) {
    Memory.versions.push(Game.version)
    console.log(`Updated v${Game.version}`)
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

  if (!Memory.regions) {
    Memory.regions = {}
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
  Game.version = version

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

  if ((Game.time % cpu_ticks) == 0) {
    const limit = Game.cpu.limit

    const info = 'info'
    const warn = 'warn'
    const error = 'error'
    const critical = 'critical'

    const critical_level = limit * 1.5
    const error_level = limit
    const warn_level = limit * 0.90

    const colors: {[index: string]: string} = {
      info: 'white',
      warn: '#F9EFBF',
      error: '#F78C6C',
      critical: '#E74C3C',
    }

    const colored_text = (text: string, level: 'info' | 'warn' | 'error' | 'critical') => {
      return `<span style='color:${colors[level]}'>${text}</span>`
    }

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

      return colored_text(`${u}`, level)
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

    const ave = colored_text(`${average}`, average_level)

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

    const b = colored_text(`${bucket}`, bucket_level)

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
  roomTick()

  if ((Game.time % 89) == 1) {
    refreshMemory()
    console.log(`Init refresh memory at ${Game.time}`)
  }

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

function refreshMemory() {
  // @todo: clear spawn, squad memory
  // Automatically delete memory of missing creeps
  for (const name in Memory.creeps) {
    if (!(name in Game.creeps)) {
      delete Memory.creeps[name]
    }
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

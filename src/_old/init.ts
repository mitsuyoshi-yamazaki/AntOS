import _ from "lodash"
import { tick as extensionTick } from "_old/extensions"
import { leveled_colored_text } from '../utility'
import { World } from "world_info/world_info"
import { SystemInfo } from "shared/utility/system_info"

export function init(): void {
  if (!Memory.versions) {
    Memory.versions = []
  }
  const version = SystemInfo.application.version
  if (Memory.versions.indexOf(version) < 0) {
    const removeCount = 10
    if (Memory.versions.length > (removeCount * 2)) {
      Memory.versions.splice(removeCount, Memory.versions.length - removeCount)
    }

    Memory.versions.push(version)
    console.log(`Updated v${version}`)
  }

  if (Memory.uniqueId == null) {
    Memory.uniqueId = {
      creepNameIndex: 0,
    }
  }
  if (Memory.gameInfo == null) {
    Memory.gameInfo = {
      whitelist: [],
      sourceHarvestWhitelist: [],
    }
  }
  if (Memory.gameInfo.whitelist == null) {
    Memory.gameInfo.whitelist = []
  }
  if (Memory.gameInfo.sourceHarvestWhitelist == null) {
    Memory.gameInfo.sourceHarvestWhitelist = []
  }
  // if (Memory.v3 == null) { // EnvironmentalVariableのロード時に存在する必要があるためそちらで行っている
  //   Memory.v3 = {
  //     enabled: false,
  //     process: {
  //       processIdIndex: 0,
  //       processInfoMemories: {},
  //     },
  //   }
  // }

  if (Memory.room_info == null) {
    Memory.room_info = {}
  }

  if (Memory.v6RoomInfo == null) {
    Memory.v6RoomInfo = {}
  }

  if (Memory.gameMap == null) {
    Memory.gameMap = {
      interRoomPath: {}
    }
  }

  if (Memory.gclFarm == null) {
    Memory.gclFarm = {
      roomNames: [],
    }
  }

  if (Memory.ignoreRooms == null) {
    Memory.ignoreRooms = []
  }

  if (Memory.pathCache == null) {
    Memory.pathCache = {
      paths: {}
    }
  }

  if (Memory.rooms == null) {
    Memory.rooms = {}
  }

  if (!Memory.cpu) {
    Memory.cpu = {
      last_bucket: Game.cpu.bucket
    }
  }

  if (!Memory.cpu_usages) {
    Memory.cpu_usages = []
  }

  if (Memory.napAlliances == null) {
    Memory.napAlliances = []
  }
}

export function tick(): void {
  const time = Game.time

  const cpu_ticks = 20
  const deletionCount = Memory.cpu_usages.length - cpu_ticks
  if (deletionCount > 0) {
    Memory.cpu_usages.splice(0, deletionCount)
  }

  const current_bucket = Game.cpu.bucket
  // const diff = current_bucket - (Memory.cpu.last_bucket || 1000) // generatePixel() によって消費されるため
  // if (((diff < -480) && (current_bucket < 9500)) || (current_bucket < 5000)) {
  //   const message = `CPU Bucket ${current_bucket} (was ${Memory.cpu.last_bucket})`
  //   console.log(leveled_colored_text(message, 'critical'))
  //   // Game.notify(message)
  // }

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

  extensionTick()
}

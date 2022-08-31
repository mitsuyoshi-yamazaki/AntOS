import _ from "lodash"
import { leveled_colored_text } from '../utility'
import { World } from "world_info/world_info"
import { tick as extensionTick } from "./extensions"

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

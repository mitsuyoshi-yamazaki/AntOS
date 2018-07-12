
declare global {
  interface Game {
    version: string
  }

  interface Memory {
    cpu_usages: number[]
    versions: string[]
    debug: {
      show_visual: boolean
    }
    parameters: {
      attenuation: number
    }
  }
}

export function init(): void {
  Game.version = '3.0.12'

  if (!Memory.cpu_usages) {
    Memory.cpu_usages = []
  }

  if (!Memory.versions) {
    Memory.versions = []
  }
  if (Memory.versions.indexOf(Game.version) < 0) {
    Memory.versions.push(Game.version)
    console.log(`Updated v${Game.version}`)
  }

  if (!Memory.debug) {
    Memory.debug = {
      show_visual: false
    }
  }

  if (!Memory.parameters) {
    Memory.parameters = {
      attenuation: 2.0
    }
  }

  const cpu_ticks = 20
  if (Memory.cpu_usages.length > cpu_ticks) {
    Memory.cpu_usages.shift()
  }

  if ((Game.time % cpu_ticks) == 0) {
    console.log(`CPU usage: ${Memory.cpu_usages}, ave: ${_.sum(Memory.cpu_usages) / cpu_ticks}`)
  }
}

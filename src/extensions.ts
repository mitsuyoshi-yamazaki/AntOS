
export enum CreepStatus {  // @todo: add "meta" info to status and keep it on memory, to not change objectives between ticks
NONE    = "none",
HARVEST = "harvest",
CHARGE  = "charge",
BUILD   = "build",
REPAIR  = "repair",
UPGRADE = "upgrade",
}

declare global {
  interface Game {
    version: string
  }

  interface Memory {
    cpu_usages: number[]
    versions: string[]
    debug: {
      show_visual: boolean,
    }
    parameters: {
      attenuation: number,
      creepCarryConstant: number,
    }

    refresh(): void
  }

  interface CreepMemory {
    status: CreepStatus
    position: {x:number, y:number, roomName: string}
    debug?: boolean
  }
}

export function init(): void {
  Game.version = '3.1.9'

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
      attenuation: 2.0,
      creepCarryConstant: 1.0,
    }
  }

  const cpu_ticks = 20
  if (Memory.cpu_usages.length > cpu_ticks) {
    Memory.cpu_usages.shift()
  }

  if ((Game.time % cpu_ticks) == 0) {
    console.log(`CPU usage: ${Memory.cpu_usages}, ave: ${_.sum(Memory.cpu_usages) / cpu_ticks}`)
  }

  // --
  Memory.refresh = function(): void {
    // @todo: clear spawn, squad memory
    // Automatically delete memory of missing creeps
    for (const name in Memory.creeps) {
      if (!(name in Game.creeps)) {
        delete Memory.creeps[name]
      }
    }
  }
}

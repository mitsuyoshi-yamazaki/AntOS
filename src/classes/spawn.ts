import { CreepStatus, ActionResult } from "./creep";

declare global {
  interface StructureSpawn {
    initialize(): void
    renewSurroundingCreeps(): ActionResult
  }

  interface SpawnMemory {
    spawning: boolean[]
  }
}

export function init() {
  StructureSpawn.prototype.initialize = function() {
    this.room.spawns.push(this)

    if (!this.memory.spawning) {
      this.memory.spawning = []
    }

    if (this.memory.spawning.length >= 1000) {
      this.memory.spawning.shift()
    }

    const spawning: boolean = !(!this.spawning)
    this.memory.spawning.push(spawning)
  }

  StructureSpawn.prototype.renewSurroundingCreeps = function(): ActionResult {
    const creeps_need_renew = this.pos.findInRange(FIND_MY_CREEPS, 1, {
      filter: (creep: Creep) => {
        return creep.memory.status == CreepStatus.WAITING_FOR_RENEW
      }
    }) as Creep[]

    if (creeps_need_renew.length == 0) {
      return ActionResult.DONE
    }

    creeps_need_renew.sort((lhs, rhs) => {
      if (lhs.ticksToLive! > rhs.ticksToLive!) {
        return 1
      }
      else if (lhs.ticksToLive! < rhs.ticksToLive!) {
        return -1
      }
      else {
        return 0
      }
    })

    creeps_need_renew.forEach((creep) => {
      this.renewCreep(creep)
    })

    return ActionResult.IN_PROGRESS
  }
}

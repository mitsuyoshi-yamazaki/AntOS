import { CreepName, isV5CreepMemory, isCreepMemory } from "prototype/creep"
import { RoomName } from "shared/utility/room_name"
import { GameObjectInfo } from "./game_object_info"
// Worldをimportしない

export interface CreepTickInfo {
  pos: RoomPosition
  hits: number
}

export interface CreepInfoInterface extends GameObjectInfo<Creep> {
  creepName: CreepName
  tickInfo: CreepTickInfo[]
}

export class CreepInfo implements CreepInfoInterface {
  public readonly tickInfo: CreepTickInfo[] = []

  public constructor(
    public readonly creepName: CreepName,
  ) { }

  public update(creep: Creep): void {
    this.tickInfo.unshift({
      pos: creep.pos,
      hits: creep.hits,
    })

    if (this.tickInfo.length > 100) {
      this.tickInfo.pop()
    }
  }
}

const creepInfo = new Map<CreepName, CreepInfo>()
const allCreeps = new Map<RoomName, Creep[]>()

export interface CreepsInterface {
  // ---- Lifecycle ---- //
  beforeTick(): Map<RoomName, Creep[]>
  afterTick(): void

  // ---- Functions ---- //
  list(): Map<RoomName, Creep[]>
  get(creepName: CreepName): Creep | null
  getInfo(creepName: CreepName): CreepInfo | null
}

export const Creeps: CreepsInterface = {
  // ---- Lifecycle ---- //
  beforeTick: function (): Map<RoomName, Creep[]> {
    allCreeps.clear()

    for (const creepName in Memory.creeps) {
      const creep = Game.creeps[creepName]
      if (creep == null) {
        delete Memory.creeps[creepName]
        continue
      }
      if (isCreepMemory(creep.memory)) {
        if (creep.memory.n !== true && creep.ticksToLive != null) {
          creep.notifyWhenAttacked(false)
        }
      }
      if (!isV5CreepMemory(creep.memory)) {
        continue
      }
      const creeps = ((): Creep[] => {
        const stored = allCreeps.get(creep.memory.p)
        if (stored != null) {
          return stored
        }
        const newList: Creep[] = []
        allCreeps.set(creep.memory.p, newList)
        return newList
      })()

      creeps.push(creep)
    }

    return new Map(allCreeps)
  },

  afterTick: function (): void {

  },

  // ---- Functions ---- //
  list: function (): Map<RoomName, Creep[]> {
    return new Map(allCreeps)
  },

  get: function (creepName: CreepName): Creep | null {
    return Game.creeps[creepName] ?? null
  },

  getInfo: function (creepName: CreepName): CreepInfo | null {
    return creepInfo.get(creepName) ?? null
  },
}

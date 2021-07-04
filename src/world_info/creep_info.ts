import { CreepName } from "prototype/creep"
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
const allCreeps: Creep[] = []

export interface CreepsInterface {
  // ---- Lifecycle ---- //
  beforeTick(): Creep[]
  afterTick(): void

  // ---- Functions ---- //
  list(): Creep[]
  get(creepName: CreepName): Creep | null
  getInfo(creepName: CreepName): CreepInfo | null
}

export const Creeps: CreepsInterface = {
  // ---- Lifecycle ---- //
  beforeTick: function (): Creep[] {
    allCreeps.splice(0, allCreeps.length)
    for (const creepName in Memory.creeps) {
      const creep = Game.creeps[creepName]
      if (creep == null) {
        delete Memory.creeps[creepName]
        continue
      }
      allCreeps.push(creep)
    }

    return allCreeps.concat([])
  },

  afterTick: function (): void {

  },

  // ---- Functions ---- //
  list: function (): Creep[] {
    return allCreeps
  },

  get: function (creepName: CreepName): Creep | null {
    return Game.creeps[creepName]
  },

  getInfo: function (creepName: CreepName): CreepInfo | null {
    return creepInfo.get(creepName) ?? null
  },
}

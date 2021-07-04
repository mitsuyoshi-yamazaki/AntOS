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

export const Creeps = {
  list: function (): Creep[] {
    return allCreeps
  },

  get: function (creepName: CreepName): Creep | null {
    return Game.creeps[creepName]
  },

  getInfo: function (creepName: CreepName): CreepInfo | null {
    return creepInfo.get(creepName) ?? null
  },

  beforeTick: function (): Creep[] {
    allCreeps.splice(0, allCreeps.length)
    // const deadCreeps = Array.from(creepInfo.keys()) // TODO:
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      // const info = creepInfo.get(creepName) ?? new CreepInfo(creepName)  // TODO:
      // info.update(creep)

      allCreeps.push(creep)
    }

    return allCreeps.concat([])
  },

  afterTick: function (): void {

  },
}

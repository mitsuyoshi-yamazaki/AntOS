import { getNewCreepsIn, requestCreep } from "./creep_provider_bridging_squad"

export interface CreepProviderObjectiveMemory {

}

export type CreepProviderObjectivePriority = 0 | 1 | 2  // 0: high, 2: low

export interface CreepProviderCreepSpec {
  specType: string
  priority: CreepProviderObjectivePriority
  targetRoomName: string
  bodyParts: Map<BodyPartConstant, number>
  recruitableCreepSpec?: {
    requiredBodyParts: Map<BodyPartConstant, number>
    remainingLifeSpan: number
  }
}

export interface CreepProviderObjectiveDelegate {
  didProvideCreep(creep: Creep, specType: string, elapsedTime: number): void
}

/**
 * - [ ] 一旦process等の仕組みは考慮に入れずに実装する
 * ---
 * - あらかじめ計算した予測の数値を代わりに使えるようにする
 *   - メモリ上の数値を読み取ってコードに入れるなど
 */
export class CreepProviderObjective {
  private readonly requirement: [CreepProviderCreepSpec, number][] = []

  public constructor(
    public readonly parentObjective: string,
    public readonly spawnRoomName: string, // TODO: 算出できるようにする
  ) {
  }

  public reserveCreeps(spec: CreepProviderCreepSpec, count: number): void {
    requestCreep(spec, count, this.spawnRoomName)
  }

  public run(): void {
    const newCreeps = getNewCreepsIn(this.spawnRoomName, "")
    newCreeps.forEach(creep => {
      creep.memory.squad_name = ""
      // TODO: notify
    })
  }
}

import { SquadType } from "_old/squad/squad"
import { ProcessId } from "task/process"
import { CreepProviderBridgingSquadMemory, getNewCreepIdsIn, requestCreep } from "task/bridging/creep_provider_bridging_squad"

export type CreepProviderPriority = 0 | 1 | 2  // 0: high, 2: low

export interface CreepProviderCreepSpec {
  specType: string
  priority: CreepProviderPriority
  targetRoomName: string
  bodyParts: Map<BodyPartConstant, number>
  recruitableCreepSpec?: {
    requiredBodyParts: Map<BodyPartConstant, number>
    remainingLifeSpan: number
  }
}

export interface CreepProviderDelegate {
  didProvideCreep(creep: Creep, specType: string, elapsedTime: number): void
}

/**
 * - [ ] 状態をもたせる(現在はCreepProviderBridgingSquadが持っている)
 * ---
 * - あらかじめ計算した予測の数値を代わりに使えるようにする
 *   - メモリ上の数値を読み取ってコードに入れるなど
 */
export class CreepProvider {
  private readonly requirement: [CreepProviderCreepSpec, number][] = []

  public constructor(
    public readonly delegate: CreepProviderDelegate,
    public readonly spawnRoomName: string, // TODO: 算出できるようにする
  ) {
  }

  public requestCreeps(spec: CreepProviderCreepSpec, count: number): void {
    requestCreep(spec, count, this.spawnRoomName)
  }

  public requestingCreepsFor(processId: ProcessId): number {
    for (const squadName in Memory.squads) {
      const squadMemory = Memory.squads[squadName]
      if (squadMemory.type !== SquadType.CREEP_PROVIDER_BRIDGING_SQUAD) {
        continue
      }
      if (squadMemory.owner_name === this.spawnRoomName) {
        return (squadMemory as CreepProviderBridgingSquadMemory).req ?? 0
      }
    }
    return 0
  }

  public run(): void {
    const newCreeps = getNewCreepIdsIn(this.spawnRoomName, "")
    newCreeps.forEach(creepId => {
      const creep = Game.getObjectById(creepId)
      if (!(creep instanceof Creep)) {
        return
      }
      creep.memory.squad_name = ""
      this.delegate.didProvideCreep(creep, "", 0)
    })
  }
}

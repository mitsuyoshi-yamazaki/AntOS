import { getNewCreepIn, requestCreep } from "task/bridging/creep_provider_bridging_squad"
import { decodeObjectivesFrom, Objective, ObjectiveState } from "task/objective"

export type CreepProviderPriority = 0 | 1 | 2  // 0: high, 2: low

export interface CreepProviderObjectiveCreepSpec {
  specIdentifier: string
  priority: CreepProviderPriority
  targetRoomName: string
  bodyParts: Map<BodyPartConstant, number>
  recruitableCreepSpec?: {
    requiredBodyParts: Map<BodyPartConstant, number>
    remainingLifeSpan: number
  }
}

export interface CreepProviderObjectiveState extends ObjectiveState {
  /** creep identifiers */
  i: string[]
}

export class CreepProviderObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private readonly requestingCreepIdentifiers: string[],
  ) { }

  public encode(): CreepProviderObjectiveState {
    return {
      s: this.startTime,
      t: "CreepProviderObjective",
      c: this.children.map(child => child.encode()),
      i: this.requestingCreepIdentifiers,
    }
  }

  public static decode(state: CreepProviderObjectiveState): CreepProviderObjective {
    const children = decodeObjectivesFrom(state.c)
    return new CreepProviderObjective(state.s, children, state.i)
  }

  public requestScout(spawnRoomName: string, priority: CreepProviderPriority, identifier: string): void {
    if (this.requestingCreepIdentifiers.includes(identifier)) {
      return
    }
    this.requestingCreepIdentifiers.push(identifier)

    const bodyParts = new Map<BodyPartConstant, number>()
    bodyParts.set(MOVE, 1)

    const spec: CreepProviderObjectiveCreepSpec = {
      specIdentifier: identifier,
      priority,
      targetRoomName: spawnRoomName,
      bodyParts,
    }
    requestCreep(spec, 1, spawnRoomName)
  }

  public checkCreep(spawnRoomName: string, identifier: string): Creep | null {
    return getNewCreepIn(spawnRoomName, identifier)
  }
}

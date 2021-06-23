import { getNewCreepIn, requestCreep } from "task/bridging/creep_provider_bridging_squad"
import { decodeObjectiveFrom, Objective, ObjectiveState } from "task/objective"

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
    const children = state.c.flatMap(childState => decodeObjectiveFrom(childState) ?? [])
    return new CreepProviderObjective(state.s, children, state.i)
  }

  public requestScout(spawnRoomName: string, priority: CreepProviderPriority, identifier: string): Creep | null {
    if (this.requestingCreepIdentifiers.includes(identifier)) {
      return this.newCreep(spawnRoomName, identifier)
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

    return this.newCreep(spawnRoomName, identifier)
  }

  private newCreep(spawnRoomName: string, identifier: string): Creep | null {
    return getNewCreepIn(spawnRoomName, identifier)
  }
}

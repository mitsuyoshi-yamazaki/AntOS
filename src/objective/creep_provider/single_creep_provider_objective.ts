import { getNewCreepIn, requestCreep } from "objective/bridging/creep_provider_bridging_squad"
import {
  decodeObjectivesFrom,
  Objective,
  ObjectiveFailed,
  ObjectiveInProgress,
  ObjectiveProgressType,
  ObjectiveState,
  ObjectiveSucceeded
} from "objective/objective"
import { ResultType } from "utility/result"

export type CreepProviderPriority = 0 | 1 | 2  // 0: high, 2: low

export interface CreepProviderObjectiveCreepSpec {
  creepIdentifier: string
  priority: CreepProviderPriority
  bodyParts: BodyPartConstant[]
}

export interface SingleCreepProviderObjectiveState extends ObjectiveState {
  /** requesting creep identifiers */
  i: string
}

export class SingleCreepProviderObjective implements Objective {
  private readonly requestCreepResult: ResultType<void, string> | null

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private readonly requestingCreepIdentifier: string,
    launchTimeArguments: {
      spawnRoomName: string,
      requestingCreepBodyParts: BodyPartConstant[],
    } | null
  ) {
    if (launchTimeArguments != null) {
      this.requestCreepResult = this.requestCreep(launchTimeArguments.spawnRoomName, launchTimeArguments.requestingCreepBodyParts)
    } else {
      this.requestCreepResult = null
    }
  }

  public encode(): SingleCreepProviderObjectiveState {
    return {
      s: this.startTime,
      t: "SingleCreepProviderObjective",
      c: this.children.map(child => child.encode()),
      i: this.requestingCreepIdentifier,
    }
  }

  public static decode(state: SingleCreepProviderObjectiveState): SingleCreepProviderObjective {
    const children = decodeObjectivesFrom(state.c)
    return new SingleCreepProviderObjective(state.s, children, state.i, null)
  }

  private requestCreep(spawnRoomName: string, bodyParts: BodyPartConstant[]): ResultType<void, string> {
    const spec: CreepProviderObjectiveCreepSpec = {
      creepIdentifier: this.requestingCreepIdentifier,
      priority: 2,
      bodyParts: bodyParts,
    }
    return requestCreep(spec, 1, spawnRoomName)
  }

  public progress(): ObjectiveProgressType<void, Creep, string> {
    if (this.requestCreepResult != null && this.requestCreepResult.resultType === "failed") {
      return new ObjectiveFailed(this.requestCreepResult.reason)
    }

    const creep = getNewCreepIn(this.requestingCreepIdentifier)
    if (creep == null) {
      return new ObjectiveInProgress<void>(undefined)
    }
    return new ObjectiveSucceeded(creep)
  }
}

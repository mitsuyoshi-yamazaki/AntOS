import { decodeObjectivesFrom, Objective, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState } from "task/objective"

type BuildFirstSpawnObjectiveProgressType = ObjectiveProgressType<string, StructureSpawn, string>

export interface BuildFirstSpawnObjectiveState extends ObjectiveState {
  /** creep IDs */
  cr: {
    /** worker */
    w: string[]
  }
}

export class BuildFirstSpawnObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly workerIds: string[],
  ) {
  }

  public encode(): BuildFirstSpawnObjectiveState {
    return {
      t: "BuildFirstSpawnObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      cr: {
        w: this.workerIds,
      }
    }
  }

  public static decode(state: BuildFirstSpawnObjectiveState): BuildFirstSpawnObjective {
    const children = decodeObjectivesFrom(state.c)
    return new BuildFirstSpawnObjective(state.s, children, state.cr.w)
  }

  public progress(targetController: StructureController, parentRoomName: string): BuildFirstSpawnObjectiveProgressType {
    return new ObjectiveInProgress("not implemented yet")
  }
}

import { decodeObjectivesFrom, Objective, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState } from "objective/objective"
import { CreepName } from "prototype/creep"
import { RoomName } from "prototype/room"

type SingleCreepRemoteProviderObjectiveProgressType = ObjectiveProgressType<void, Creep, string>

export interface SingleCreepRemoteProviderObjectiveState extends ObjectiveState {
  /** requesting creep name */
  n: CreepName

  /** portal */
  p: {
    /** room contains ENTRANCE portal */
    e: RoomName,

    /** room contains EXIT portal */
    d: RoomName,
  }
}

export class SingleCreepRemoteProviderObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private readonly creepName: CreepName,

    /** room contains ENTRANCE portal */
    private readonly portalRoomName: RoomName,

    /** room contains EXIT portal */
    private readonly destinationPortalRoomName: RoomName,
  ) {
  }

  public encode(): SingleCreepRemoteProviderObjectiveState {
    return {
      s: this.startTime,
      t: "SingleCreepRemoteProviderObjective",
      c: this.children.map(child => child.encode()),
      n: this.creepName,
      p: {
        e: this.portalRoomName,
        d: this.destinationPortalRoomName,
      }
    }
  }

  public static decode(state: SingleCreepRemoteProviderObjectiveState): SingleCreepRemoteProviderObjective {
    const children = decodeObjectivesFrom(state.c)
    return new SingleCreepRemoteProviderObjective(state.s, children, state.n, state.p.e, state.p.d)
  }

  public progress(): SingleCreepRemoteProviderObjectiveProgressType {
    return new ObjectiveInProgress(undefined) // TODO:
  }
}

import { decodeObjectivesFrom, Objective, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState } from "old_objective/objective"
import { CreepName } from "prototype/creep"
import { RoomName } from "prototype/room"
import { ShardName } from "prototype/shard"

type SingleCreepInterShardProviderObjectiveProgressType = ObjectiveProgressType<void, Creep, string>

export interface SingleCreepInterShardProviderObjectiveState extends ObjectiveState {
  /** requesting creep name */
  n: CreepName

  /** parent shard name */
  p: ShardName
}

/**
 * - 他shardに対するcreepリクエスト
 * - creepがshardに出現したら成功して終了
 */
export class SingleCreepInterShardProviderObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private readonly creepName: CreepName,
    private readonly parentShardName: ShardName,
  ) {
  }

  public encode(): SingleCreepInterShardProviderObjectiveState {
    return {
      s: this.startTime,
      t: "SingleCreepInterShardProviderObjective",
      c: this.children.map(child => child.encode()),
      n: this.creepName,
      p: this.parentShardName,
    }
  }

  public static decode(state: SingleCreepInterShardProviderObjectiveState): SingleCreepInterShardProviderObjective {
    const children = decodeObjectivesFrom(state.c)
    return new SingleCreepInterShardProviderObjective(state.s, children, state.n, state.p)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public request(parentRoomName: RoomName, portalRoomName: RoomName): void {

  }

  public progress(): SingleCreepInterShardProviderObjectiveProgressType {
    return new ObjectiveInProgress(undefined) // TODO:
  }
}

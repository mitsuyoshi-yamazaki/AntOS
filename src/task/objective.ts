import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { SignRoomObjective, SignRoomObjectiveState } from "task/sign_rooms/sign_rooms_objective"
import { BootstrapRoomObjective, BootstrapRoomObjectiveState } from "./bootstrap_room/bootstarp_room_objective"
import { ClaimRoomObjective, ClaimRoomObjectiveState } from "./bootstrap_room/claim_room_objective"
import { SingleCreepProviderObjective, SingleCreepProviderObjectiveState } from "./creep_provider/single_creep_provider_objective"
import { ScoutObserveRoomObjective, ScoutObserveRoomObjectiveState } from "./remote_room/observe_room"

/**
 * - https://zenn.dev/mitsuyoshi/scraps/3917e7502ef385#comment-e0d2fee7895843
 * - Prioritize
 *   - CPU時間が余っている→全て実行
 *   - bucketを食っている→
 *     - alwaysを実行
 *     - normalの順位づけを行い、時間いっぱいまで実行→
 *       - 足りなかったら次tickへ持ち越し
 *       - 余ったら次の順位を実行→
 *         - 全て実行しても余ったらif possibleを実行
 */

export interface ObjectiveState extends State {
  /** type identifier */
  t: keyof ObjectiveTypes

  /** start time */
  s: number

  /** children objective state */
  c: ObjectiveState[]
}

export class ObjectiveInProgress<T> {
  public readonly objectProgressType = "in progress"
  public constructor(public readonly value: T) { }
}

export class ObjectiveSucceeded<Result> {
  public readonly objectProgressType = "succeeded"
  public constructor(public readonly result: Result) { }
}

export class ObjectiveFailed<Reason> {
  public readonly  objectProgressType = "failed"
  public constructor(public readonly reason: Reason) { }
}

export type ObjectiveProgressType<T, S, U> = ObjectiveInProgress<T> | ObjectiveSucceeded<S> | ObjectiveFailed<U>

export interface Objective extends Stateful {
  startTime: number
  children: Objective[]

  encode(): ObjectiveState
  objectiveDescription?(): string
}

class ObjectiveTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "SignRoomObjective" = (state: ObjectiveState) => SignRoomObjective.decode(state as SignRoomObjectiveState)
  "SingleCreepProviderObjective" = (state: ObjectiveState) => SingleCreepProviderObjective.decode(state as SingleCreepProviderObjectiveState)
  "BootstrapRoomObjective" = (state: ObjectiveState) => BootstrapRoomObjective.decode(state as BootstrapRoomObjectiveState)
  "ClaimRoomObjective" = (state: ObjectiveState) => ClaimRoomObjective.decode(state as ClaimRoomObjectiveState)
  "ScoutObserveRoomObjective" = (state: ObjectiveState) => ScoutObserveRoomObjective.decode(state as ScoutObserveRoomObjectiveState)
}

export function decodeObjectiveFrom(state: ObjectiveState): Objective | null {
  let decoded: Objective | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new ObjectiveTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `restoreObjectiveFrom(), objective type: ${state.t}`)()
  return decoded
}

export function decodeObjectivesFrom(states: ObjectiveState[]): Objective[] {
  return states.reduce((result, childState) => {
    const child = decodeObjectiveFrom(childState)
    if (child != null) {
      result.push(child)
    }
    return result
  }, [] as Objective[])
}

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { BootstrapL8RoomObjective, BootstrapL8RoomObjectiveState } from "./bootstrap_room/bootstarp_l8_room_objective"
import { OldClaimRoomObjective, OldClaimRoomObjectiveState } from "./bootstrap_room/old_claim_room_objective"
import { UpgradeL3ControllerObjective, UpgradeL3ControllerObjectiveState } from "./bootstrap_room/upgrade_l3_controller_objective"
import { SingleCreepProviderObjective, SingleCreepProviderObjectiveState } from "./creep_provider/single_creep_provider_objective"
import { RoomKeeperObjective, RoomKeeperObjectiveState } from "./room_keeper/room_keeper_objective"
import { SpawnCreepObjective, SpawnCreepObjectiveState } from "./spawn/spawn_creep_objective"
import { PrimitiveWorkerObjective, PrimitiveWorkerObjectiveState } from "./worker/primitive_worker_objective"
import { DefendOwnedRoomObjective, DefendOwnedRoomObjectiveState } from "./defend_room/defend_owned_room_objective"
import { ClaimRoomObjective, ClaimRoomObjectiveState } from "./bootstrap_room/claim_room_objective"
import { OldBuildFirstSpawnObjective, OldBuildFirstSpawnObjectiveState } from "./bootstrap_room/old_build_first_spawn_objective"
import { SingleCreepRemoteProviderObjective, SingleCreepRemoteProviderObjectiveState } from "./creep_provider/single_creep_remote_provider_objective"
import { SingleCreepInterShardProviderObjective, SingleCreepInterShardProviderObjectiveState } from "./creep_provider/single_creep_inter_shard_provider_objective"
import { InterShardCreepDelivererObjective, InterShardCreepDelivererObjectiveState } from "./creep_provider/inter_shard_creep_deliverer_objective"
import { MultiRoleWorkerObjective, MultiRoleWorkerObjectiveState } from "./worker/multi_role_worker_objective"

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
  "SingleCreepProviderObjective" = (state: ObjectiveState) => SingleCreepProviderObjective.decode(state as SingleCreepProviderObjectiveState)
  "BootstrapL8RoomObjective" = (state: ObjectiveState) => BootstrapL8RoomObjective.decode(state as BootstrapL8RoomObjectiveState)
  "OldClaimRoomObjective" = (state: ObjectiveState) => OldClaimRoomObjective.decode(state as OldClaimRoomObjectiveState)
  "OldBuildFirstSpawnObjective" = (state: ObjectiveState) => OldBuildFirstSpawnObjective.decode(state as OldBuildFirstSpawnObjectiveState)
  "UpgradeL3ControllerObjective" = (state: ObjectiveState) => UpgradeL3ControllerObjective.decode(state as UpgradeL3ControllerObjectiveState)
  "RoomKeeperObjective" = (state: ObjectiveState) => RoomKeeperObjective.decode(state as RoomKeeperObjectiveState)
  "SpawnCreepObjective" = (state: ObjectiveState) => SpawnCreepObjective.decode(state as SpawnCreepObjectiveState)
  "PrimitiveWorkerObjective" = (state: ObjectiveState) => PrimitiveWorkerObjective.decode(state as PrimitiveWorkerObjectiveState)
  "DefendOwnedRoomObjective" = (state: ObjectiveState) => DefendOwnedRoomObjective.decode(state as DefendOwnedRoomObjectiveState)
  "ClaimRoomObjective" = (state: ObjectiveState) => ClaimRoomObjective.decode(state as ClaimRoomObjectiveState)
  "SingleCreepRemoteProviderObjective" = (state: ObjectiveState) => SingleCreepRemoteProviderObjective.decode(state as SingleCreepRemoteProviderObjectiveState)
  "SingleCreepInterShardProviderObjective" = (state: ObjectiveState) => SingleCreepInterShardProviderObjective.decode(state as SingleCreepInterShardProviderObjectiveState)
  "InterShardCreepDelivererObjective" = (state: ObjectiveState) => InterShardCreepDelivererObjective.decode(state as InterShardCreepDelivererObjectiveState)
  "MultiRoleWorkerObjective" = (state: ObjectiveState) => MultiRoleWorkerObjective.decode(state as MultiRoleWorkerObjectiveState)
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

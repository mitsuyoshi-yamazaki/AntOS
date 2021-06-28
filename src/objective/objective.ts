import { ErrorMapper } from "error_mapper/ErrorMapper"
import { State, Stateful } from "os/infrastructure/state"
import { SignRoomObjective, SignRoomObjectiveState } from "objective/sign_rooms/sign_rooms_objective"
import { BootstrapL8RoomObjective, BootstrapL8RoomObjectiveState } from "./bootstrap_room/bootstarp_l8_room_objective"
import { BuildFirstSpawnObjective, BuildFirstSpawnObjectiveState } from "./bootstrap_room/build_first_spawn_objective"
import { ClaimRoomObjective, ClaimRoomObjectiveState } from "./bootstrap_room/claim_room_objective"
import { UpgradeL3ControllerObjective, UpgradeL3ControllerObjectiveState } from "./bootstrap_room/upgrade_l3_controller_objective"
import { SingleCreepProviderObjective, SingleCreepProviderObjectiveState } from "./creep_provider/single_creep_provider_objective"
import { RoomKeeperObjective, RoomKeeperObjectiveState } from "./room_keeper/room_keeper_objective"
import { SourceEnergyHarvester300Objective, SourceEnergyHarvester300ObjectiveState } from "./energy_harvester/source_energy_harvester_300_objective"
import { SpawnCreepObjective, SpawnCreepObjectiveState } from "./spawn/spawn_creep_objective"

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
  "BootstrapL8RoomObjective" = (state: ObjectiveState) => BootstrapL8RoomObjective.decode(state as BootstrapL8RoomObjectiveState)
  "ClaimRoomObjective" = (state: ObjectiveState) => ClaimRoomObjective.decode(state as ClaimRoomObjectiveState)
  "BuildFirstSpawnObjective" = (state: ObjectiveState) => BuildFirstSpawnObjective.decode(state as BuildFirstSpawnObjectiveState)
  "UpgradeL3ControllerObjective" = (state: ObjectiveState) => UpgradeL3ControllerObjective.decode(state as UpgradeL3ControllerObjectiveState)
  "RoomKeeperObjective" = (state: ObjectiveState) => RoomKeeperObjective.decode(state as RoomKeeperObjectiveState)
  "SourceEnergyHarvester300Objective" = (state: ObjectiveState) => SourceEnergyHarvester300Objective.decode(state as SourceEnergyHarvester300ObjectiveState)
  "SpawnCreepObjective" = (state: ObjectiveState) => SpawnCreepObjective.decode(state as SpawnCreepObjectiveState)
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

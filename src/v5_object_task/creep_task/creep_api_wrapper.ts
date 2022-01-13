import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ApiWrapper, ApiWrapperState } from "v5_object_task/api_wrapper"
import { BuildApiWrapper, BuildApiWrapperState } from "./api_wrapper/build_api_wrapper"
import { ClaimControllerApiWrapper, ClaimControllerApiWrapperState } from "./api_wrapper/claim_controller_api_wrapper"
import { HarvestEnergyApiWrapper, HarvestEnergyApiWrapperState } from "./api_wrapper/harvest_energy_api_wrapper"
import { RepairApiWrapper, RepairApiWrapperState } from "./api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper, TransferEnergyApiWrapperState } from "./api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper, UpgradeControllerApiWrapperState } from "./api_wrapper/upgrade_controller_api_wrapper"
import { GetEnergyApiWrapper, GetEnergyApiWrapperState } from "./api_wrapper/get_energy_api_wrapper"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { DropResourceApiWrapper, DropResourceApiWrapperState } from "./api_wrapper/drop_resource_api_wrapper"
import { ReserveControllerApiWrapper, ReserveControllerApiWrapperState } from "./api_wrapper/reserve_controller_api_wrapper"
import { KeepHarvestingApiWrapper, KeepHarvestingApiWrapperState } from "./api_wrapper/keep_harvesting_api_wrapper"
import { DismantleApiWrapper, DismantleApiWrapperState } from "./api_wrapper/dismantle_api_wrapper"
import { AttackApiWrapper, AttackApiWrapperState } from "./api_wrapper/attack_api_wrapper"
import { TransferResourceApiWrapper, TransferResourceApiWrapperState } from "./api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper, WithdrawResourceApiWrapperState } from "./api_wrapper/withdraw_resource_api_wrapper"
import { TempRenewApiWrapper, TempRenewApiWrapperState } from "./api_wrapper/temp_renew_api_wrapper"
import { SuicideApiWrapper } from "./api_wrapper/suicide_api_wrapper"
import { BoostApiWrapper, BoostApiWrapperState } from "./api_wrapper/boost_api_wrapper"
import { RangedAttackApiWrapper, RangedAttackApiWrapperState } from "./api_wrapper/ranged_attack_api_wrapper"
import { HealApiWrapper, HealApiWrapperState } from "./api_wrapper/heal_api_wrapper"
import { PickupApiWrapper, PickupApiWrapperState } from "./api_wrapper/pickup_api_wrapper"
import { AttackControllerApiWrapper, AttackControllerApiWrapperState } from "./api_wrapper/attack_controller_api_wrapper"
import { WithdrawApiWrapper, WithdrawApiWrapperState } from "./api_wrapper/withdraw_api_wrapper"

export interface CreepApiWrapperState extends ApiWrapperState {
  t: keyof CreepApiWrapperDecoderMap
}

export interface CreepApiWrapper<Result> extends ApiWrapper<Creep, Result> {
  encode(): CreepApiWrapperState
  run(creep: Creep): Result
}

export type CreepApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_NOT_ENOUGH_RESOURCES | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR
export type AnyCreepApiWrapper = CreepApiWrapper<CreepApiWrapperResult>

// generic typeなので型定義必須
type CreepApiWrapperType = HarvestEnergyApiWrapper
  | TransferEnergyApiWrapper
  | UpgradeControllerApiWrapper
  | BuildApiWrapper
  | RepairApiWrapper
  | ClaimControllerApiWrapper
  | GetEnergyApiWrapper
  | DropResourceApiWrapper
  | ReserveControllerApiWrapper
  | KeepHarvestingApiWrapper
  | DismantleApiWrapper
  | AttackApiWrapper
  | TransferResourceApiWrapper
  | WithdrawResourceApiWrapper
  | TempRenewApiWrapper
  | SuicideApiWrapper
  | BoostApiWrapper
  | RangedAttackApiWrapper
  | HealApiWrapper
  | PickupApiWrapper
  | AttackControllerApiWrapper
  | WithdrawApiWrapper

class CreepApiWrapperDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestEnergyApiWrapper" = (state: CreepApiWrapperState) => HarvestEnergyApiWrapper.decode(state as HarvestEnergyApiWrapperState)
  "TransferEnergyApiWrapper" = (state: CreepApiWrapperState) => TransferEnergyApiWrapper.decode(state as TransferEnergyApiWrapperState)
  "UpgradeControllerApiWrapper" = (state: CreepApiWrapperState) => UpgradeControllerApiWrapper.decode(state as UpgradeControllerApiWrapperState)
  "BuildApiWrapper" = (state: CreepApiWrapperState) => BuildApiWrapper.decode(state as BuildApiWrapperState)
  "RepairApiWrapper" = (state: CreepApiWrapperState) => RepairApiWrapper.decode(state as RepairApiWrapperState)
  "ClaimControllerApiWrapper" = (state: CreepApiWrapperState) => ClaimControllerApiWrapper.decode(state as ClaimControllerApiWrapperState)
  "GetEnergyApiWrapper" = (state: CreepApiWrapperState) => GetEnergyApiWrapper.decode(state as GetEnergyApiWrapperState)
  "DropResourceApiWrapper" = (state: CreepApiWrapperState) => DropResourceApiWrapper.decode(state as DropResourceApiWrapperState)
  "ReserveControllerApiWrapper" = (state: CreepApiWrapperState) => ReserveControllerApiWrapper.decode(state as ReserveControllerApiWrapperState)
  "KeepHarvestingApiWrapper" = (state: CreepApiWrapperState) => KeepHarvestingApiWrapper.decode(state as KeepHarvestingApiWrapperState)
  "DismantleApiWrapper" = (state: CreepApiWrapperState) => DismantleApiWrapper.decode(state as DismantleApiWrapperState)
  "AttackApiWrapper" = (state: CreepApiWrapperState) => AttackApiWrapper.decode(state as AttackApiWrapperState)
  "TransferResourceApiWrapper" = (state: CreepApiWrapperState) => TransferResourceApiWrapper.decode(state as TransferResourceApiWrapperState)
  "WithdrawResourceApiWrapper" = (state: CreepApiWrapperState) => WithdrawResourceApiWrapper.decode(state as WithdrawResourceApiWrapperState)
  "TempRenewApiWrapper" = (state: CreepApiWrapperState) => TempRenewApiWrapper.decode(state as TempRenewApiWrapperState)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  "SuicideApiWrapper" = (state: CreepApiWrapperState) => SuicideApiWrapper.decode()
  "BoostApiWrapper" = (state: CreepApiWrapperState) => BoostApiWrapper.decode(state as BoostApiWrapperState)
  "RangedAttackApiWrapper" = (state: CreepApiWrapperState) => RangedAttackApiWrapper.decode(state as RangedAttackApiWrapperState)
  "HealApiWrapper" = (state: CreepApiWrapperState) => HealApiWrapper.decode(state as HealApiWrapperState)
  "PickupApiWrapper" = (state: CreepApiWrapperState) => PickupApiWrapper.decode(state as PickupApiWrapperState)
  "AttackControllerApiWrapper" = (state: CreepApiWrapperState) => AttackControllerApiWrapper.decode(state as AttackControllerApiWrapperState)
  "WithdrawApiWrapper" = (state: CreepApiWrapperState) => WithdrawApiWrapper.decode(state as WithdrawApiWrapperState)
}
const decoderMap = new CreepApiWrapperDecoderMap()

export function decodeCreepApiWrapperFromState(state: CreepApiWrapperState): CreepApiWrapperType | null {
  const result = ErrorMapper.wrapLoop((): CreepApiWrapperType | false => {
    const decoder = decoderMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (API wrapper type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
      return false
    }
    return decoder(state) ?? false
  }, `decodeCreepTaskFromState(), objective type: ${state.t}`)()

  if (result === false) {
    return null
  }
  if (result == null) {
    if (state.t !== "BuildApiWrapper") {
      const message = `Decode failed by program bug (API wrapper type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
    }
    return null
  }
  return result
}

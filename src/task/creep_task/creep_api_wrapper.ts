import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ApiWrapper, ApiWrapperState } from "task/api_wrapper"
import { BuildApiWrapper, BuildApiWrapperState } from "./api_wrapper/build_api_wrapper"
import { HarvestEnergyApiWrapper, HarvestEnergyApiWrapperState } from "./api_wrapper/harvest_energy_api_wrapper"
import { RepairApiWrapper, RepairApiWrapperState } from "./api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper, TransferEnergyApiWrapperState } from "./api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper, UpgradeControllerApiWrapperState } from "./api_wrapper/upgrade_controller_api_wrapper"

export interface CreepApiWrapperState extends ApiWrapperState {
  t: keyof CreepApiWrapperDecoderMap
}

export interface CreepApiWrapper<Result> extends ApiWrapper<Creep, Result> {
  encode(): CreepApiWrapperState
  run(creep: Creep): Result
}

// generic typeなので型定義必須
type CreepApiWrapperType = HarvestEnergyApiWrapper
  | TransferEnergyApiWrapper
  | UpgradeControllerApiWrapper
  | BuildApiWrapper
  | RepairApiWrapper

class CreepApiWrapperDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestEnergyApiWrapper" = (state: CreepApiWrapperState) => HarvestEnergyApiWrapper.decode(state as HarvestEnergyApiWrapperState)
  "TransferEnergyApiWrapper" = (state: CreepApiWrapperState) => TransferEnergyApiWrapper.decode(state as TransferEnergyApiWrapperState)
  "UpgradeControllerApiWrapper" = (state: CreepApiWrapperState) => UpgradeControllerApiWrapper.decode(state as UpgradeControllerApiWrapperState)
  "BuildApiWrapper" = (state: CreepApiWrapperState) => BuildApiWrapper.decode(state as BuildApiWrapperState)
  "RepairApiWrapper" = (state: CreepApiWrapperState) => RepairApiWrapper.decode(state as RepairApiWrapperState)
}
const decoderMap = new CreepApiWrapperDecoderMap()

export function decodeCreepApiWrapperFromState(state: CreepApiWrapperState): CreepApiWrapperType | null {
  const result = ErrorMapper.wrapLoop((): CreepApiWrapperType | null => {
    const decoder = decoderMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (API wrapper type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
      return null
    }
    return decoder(state)
  }, `decodeCreepTaskFromState(), objective type: ${state.t}`)()

  if (result == null) {
    if (state.t !== "BuildApiWrapper") {
      const message = `Decode failed by program bug (API wrapper type identifier: ${state.t})`
      PrimitiveLogger.fatal(message)
    }
    return null
  }
  return result
}

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ApiWrapper, ApiWrapperState } from "task/api_wrapper"
import { HarvestEnergyApiWrapper, HarvestEnergyApiWrapperState } from "./api_wrapper/harvest_energy_api_wrapper"
import { TransferEnergyApiWrapper, TransferEnergyApiWrapperState } from "./api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper, UpgradeControllerApiWrapperState } from "./api_wrapper/upgrade_controller_api_wrapper"

export interface CreepApiWrapperState extends ApiWrapperState {
  t: keyof CreepApiWrapperDecoderMap
}

export interface CreepApiWrapper<Result> extends ApiWrapper<Creep, Result> {
  encode(): CreepApiWrapperState
  run(creep: Creep): Result
}

type CreepApiWrapperType = HarvestEnergyApiWrapper | TransferEnergyApiWrapper | UpgradeControllerApiWrapper

class CreepApiWrapperDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestEnergyApiWrapper" = (state: CreepApiWrapperState) => HarvestEnergyApiWrapper.decode(state as HarvestEnergyApiWrapperState)
  "TransferEnergyApiWrapper" = (state: CreepApiWrapperState) => TransferEnergyApiWrapper.decode(state as TransferEnergyApiWrapperState)
  "UpgradeControllerApiWrapper" = (state: CreepApiWrapperState) => UpgradeControllerApiWrapper.decode(state as UpgradeControllerApiWrapperState)
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
    const message = `Decode failed by program bug (API wrapper type identifier: ${state.t})`
    PrimitiveLogger.fatal(message)
    return null
  }
  return result
}

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import type { CreepApiWrapper, CreepApiWrapperState } from "./creep_api_wrapper"
import { BuildApiWrapper, BuildApiWrapperState } from "./api_wrapper/build_api_wrapper"
import { HarvestSourceApiWrapper, HarvestSourceApiWrapperState } from "./api_wrapper/harvest_source_api_wrapper"
import { MoveApiWrapper, MoveApiWrapperState } from "./api_wrapper/move_api_wrapper"
import { MoveToApiWrapper, MoveToApiWrapperState } from "./api_wrapper/move_to_api_wrapper"
import { RepairApiWrapper, RepairApiWrapperState } from "./api_wrapper/repair_api_wrapper"
import { TransferApiWrapper, TransferApiWrapperState } from "./api_wrapper/transfer_api_wrapper"
import { UpgradeControllerApiWrapper, UpgradeControllerApiWrapperState } from "./api_wrapper/upgrade_controller_api_wrapper"

export type CreepApiWrapperType = keyof CreepApiWrapperDecoderMap
class CreepApiWrapperDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestSourceApiWrapper" = (state: CreepApiWrapperState) => HarvestSourceApiWrapper.decode(state as HarvestSourceApiWrapperState)
  "MoveToApiWrapper" = (state: CreepApiWrapperState) => MoveToApiWrapper.decode(state as MoveToApiWrapperState)
  "TransferApiWrapper" = (state: CreepApiWrapperState) => TransferApiWrapper.decode(state as TransferApiWrapperState)
  "RepairApiWrapper" = (state: CreepApiWrapperState) => RepairApiWrapper.decode(state as RepairApiWrapperState)
  "BuildApiWrapper" = (state: CreepApiWrapperState) => BuildApiWrapper.decode(state as BuildApiWrapperState)
  "UpgradeControllerApiWrapper" = (state: CreepApiWrapperState) => UpgradeControllerApiWrapper.decode(state as UpgradeControllerApiWrapperState)
  "MoveApiWrapper" = (state: CreepApiWrapperState) => MoveApiWrapper.decode(state as MoveApiWrapperState)
}
const decoderMap = new CreepApiWrapperDecoderMap()

export function decodeCreepApiWrapperFromState(state: CreepApiWrapperState): CreepApiWrapper | null {
  const result = ErrorMapper.wrapLoop((): CreepApiWrapper | false => {
    const decoder = decoderMap[state.t]
    if (decoder == null) {
      const message = `Decode failed by program bug: missing decoder (API wrapper type identifier: ${state.t})`
      PrimitiveLogger.programError(message)
      return false
    }
    return decoder(state) ?? false
  }, `decodeCreepTaskFromState(), objective type: ${state.t}`)()

  if (result === false) {
    return null
  }
  if (result == null) {
    const message = `Decode failed by program bug (API wrapper type identifier: ${state.t})`
    PrimitiveLogger.programError(message)
    return null
  }
  return result
}

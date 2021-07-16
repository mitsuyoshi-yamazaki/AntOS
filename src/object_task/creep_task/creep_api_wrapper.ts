import type { Problem } from "application/problem"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { ApiWrapper, ApiWrapperProgress, ApiWrapperState } from "object_task/api_wrapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { V6Creep } from "prototype/creep"
import { BuildApiWrapper, BuildApiWrapperState } from "./api_wrapper/build_api_wrapper"
import { HarvestSourceApiWrapper, HarvestSourceApiWrapperState } from "./api_wrapper/harvest_source_api_wrapper"
import { MoveToApiWrapper, MoveToApiWrapperState } from "./api_wrapper/move_to_api_wrapper"
import { RepairApiWrapper, RepairApiWrapperState } from "./api_wrapper/repair_api_wrapper"
import { TransferApiWrapper, TransferApiWrapperState } from "./api_wrapper/transfer_api_wrapper"
import { UpgradeControllerApiWrapper, UpgradeControllerApiWrapperState } from "./api_wrapper/upgrade_controller_api_wrapper"

export type CreepApiWrapperProgress = ApiWrapperProgress
export const CreepApiWrapperProgress = {
  InProgress: ApiWrapperProgress.InProgress,
  Finished: ApiWrapperProgress.Finished,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  Failed: (problem: Problem) => ApiWrapperProgress.Failed(problem),
}

export interface CreepApiWrapperState extends ApiWrapperState {
  /** type identifier */
  t: CreepApiWrapperType
}

export interface CreepApiWrapper extends ApiWrapper<Creep> {
  shortDescription: string

  encode(): CreepApiWrapperState
  run(creep: V6Creep): CreepApiWrapperProgress
}

export type CreepApiWrapperType = keyof CreepApiWrapperDecoderMap
class CreepApiWrapperDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestSourceApiWrapper" = (state: CreepApiWrapperState) => HarvestSourceApiWrapper.decode(state as HarvestSourceApiWrapperState)
  "MoveToApiWrapper" = (state: CreepApiWrapperState) => MoveToApiWrapper.decode(state as MoveToApiWrapperState)
  "TransferApiWrapper" = (state: CreepApiWrapperState) => TransferApiWrapper.decode(state as TransferApiWrapperState)
  "RepairApiWrapper" = (state: CreepApiWrapperState) => RepairApiWrapper.decode(state as RepairApiWrapperState)
  "BuildApiWrapper" = (state: CreepApiWrapperState) => BuildApiWrapper.decode(state as BuildApiWrapperState)
  "UpgradeControllerApiWrapper" = (state: CreepApiWrapperState) => UpgradeControllerApiWrapper.decode(state as UpgradeControllerApiWrapperState)
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

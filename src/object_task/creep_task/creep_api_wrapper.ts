import { ErrorMapper } from "error_mapper/ErrorMapper"
import type { ApiErrorCode } from "object_task/api_error"
import { ApiWrapper, ApiWrapperProgress, ApiWrapperState } from "object_task/api_wrapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import type { CreepName } from "prototype/creep"
import type { CreepApi } from "./creep_api"
import { HarvestSourceApiWrapper, HarvestSourceApiWrapperState } from "./api_wrapper/harvest_source_api_wrapper"

export type CreepApiWrapperProgress = ApiWrapperProgress<CreepApi, CreepName>
export const CreepApiWrapperProgress = {
  InProgress: ApiWrapperProgress.InProgress,
  Finished: ApiWrapperProgress.Finished,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  Failed: (api: CreepApi, creepName: CreepName, errorCode: ApiErrorCode, detail?: string) => ApiWrapperProgress.Failed(api, creepName, errorCode, detail),
}

export interface CreepApiWrapperState extends ApiWrapperState {
  /** type identifier */
  t: CreepApiWrapperType
}

export interface CreepApiWrapper extends ApiWrapper<Creep, CreepApi, CreepName> {
  shortDescription: string

  encode(): CreepApiWrapperState
  run(creep: Creep): CreepApiWrapperProgress
}

export type CreepApiWrapperType = keyof CreepApiWrapperDecoderMap
class CreepApiWrapperDecoderMap {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestSourceApiWrapper" = (state: CreepApiWrapperState) => HarvestSourceApiWrapper.decode(state as HarvestSourceApiWrapperState)
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

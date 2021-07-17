import type { Problem } from "application/problem"
import { ApiWrapper, ApiWrapperProgress, ApiWrapperState } from "object_task/api_wrapper"
import type { V6Creep } from "prototype/creep"
import type { CreepApiWrapperType } from "./creep_api_wrapper_decoder"

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

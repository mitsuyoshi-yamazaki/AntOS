import type { ApiError } from "object_task/api_error"
import type { CreepName } from "prototype/creep"
import type { CreepApiWrapperType } from "./creep_api_wrapper"

export type CreepApiError = ApiError<CreepApiWrapperType, CreepName>

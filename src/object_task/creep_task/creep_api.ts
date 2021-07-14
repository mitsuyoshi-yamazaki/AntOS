import type { ApiError } from "object_task/api_error"
import type { CreepName } from "prototype/creep"

export type CreepApi = "harvest" | "build"

export type CreepApiError = ApiError<CreepApi, CreepName>

import { State, Stateful } from "os/infrastructure/state"
import type { ApiError, ApiErrorCode } from "./api_error"

interface ApiWrapperProgressInProgress {
  apiWrapperProgressType: "in progress"
  notInRange: boolean
}
interface ApiWrapperProgressFinished {
  apiWrapperProgressType: "finished"
  executed: boolean
}
interface ApiWrapperProgressFailed<Api, ObjectIdentifier> {
  apiWrapperProgressType: "failed"
  error: ApiError<Api, ObjectIdentifier>
}

export type ApiWrapperProgress<Api, ObjectIdentifier> = ApiWrapperProgressInProgress | ApiWrapperProgressFinished | ApiWrapperProgressFailed<Api, ObjectIdentifier>
export const ApiWrapperProgress = {
  InProgress(notInRange: boolean): ApiWrapperProgressInProgress {
    return {
      apiWrapperProgressType: "in progress",
      notInRange,
    }
  },
  Finished(executed: boolean): ApiWrapperProgressFinished {
    return {
      apiWrapperProgressType: "finished",
      executed,
    }
  },
  Failed<Api, ObjectIdentifier>(api: Api, objectIdentifier: ObjectIdentifier, errorCode: ApiErrorCode, detail?: string): ApiWrapperProgressFailed<Api, ObjectIdentifier> {
    return {
      apiWrapperProgressType: "failed",
      error: {
        api,
        objectIdentifier,
        error: errorCode,
        detail: detail ?? null,
      },
    }
  }
}

export interface ApiWrapperState extends State {
}

export interface ApiWrapper<ObjectType, Api, ObjectIdentifier> extends Stateful {
  encode(): ApiWrapperState
  run(obj: ObjectType): ApiWrapperProgress<Api, ObjectIdentifier>
}

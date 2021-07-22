import type { Problem } from "application/problem"
import { State, Stateful } from "os/infrastructure/state"

interface ApiWrapperProgressInProgress {
  apiWrapperProgressType: "in progress"
  notInRange: boolean
}
interface ApiWrapperProgressFinished {
  apiWrapperProgressType: "finished"
  executed: boolean
}
interface ApiWrapperProgressFailed {
  apiWrapperProgressType: "failed"
  problem: Problem
}

export type ApiWrapperProgress = ApiWrapperProgressInProgress | ApiWrapperProgressFinished | ApiWrapperProgressFailed
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
  Failed(problem: Problem): ApiWrapperProgressFailed {
    return {
      apiWrapperProgressType: "failed",
      problem,
    }
  }
}

export interface ApiWrapperState extends State {
}

export interface ApiWrapper<ObjectType> extends Stateful {
  encode(): ApiWrapperState
  run(obj: ObjectType): ApiWrapperProgress
}

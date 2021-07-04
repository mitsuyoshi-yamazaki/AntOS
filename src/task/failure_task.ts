import { Task, TaskFailed, TaskState, TaskTargetIdType } from "./task"

export class DecodeFailureTaskReasonTargetNotFound {
  public readonly failedType = "target not found"

  public constructor(
    public readonly targetId: TaskTargetIdType,
  ) { }
}

export class DecodeFailureTaskReasonUnknown {
  public readonly failedType = "unknown"
}

export type DecodeFailureTaskReason = DecodeFailureTaskReasonTargetNotFound | DecodeFailureTaskReasonUnknown

/** Decodeに失敗したという情報をrun()時まで保管するTask */
export class DecodeFailureTask<T> implements Task<T, void, void, DecodeFailureTaskReason> {
  public constructor(
    public readonly taskIdentifier: string,
    public readonly startTime: number,
    public readonly reason: DecodeFailureTaskReason,
  ) { }

  public encode(): TaskState {
    return {
      t: "DecodeFailureTask",
      s: this.startTime,
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public run(obj: T): TaskFailed<DecodeFailureTaskReason> {
    return new TaskFailed(this.reason)
  }
}

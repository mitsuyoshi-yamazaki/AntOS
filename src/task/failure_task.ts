import { Task, taskProgressTypeFinished, TaskProgressTypeFinished, TaskState, TaskTargetIdType } from "./task"

export class DecodeFailureTaskReasonTargetNotFound {
  public readonly failedType = "target not found"

  public constructor(
    public readonly targetId: TaskTargetIdType,
  ) { }
}

export class DecodeFailureTaskReasonProgramBug {
  public readonly failedType = "program bug"

  public constructor(
    public readonly reason?: string,
  ) { }
}

export type DecodeFailureTaskReason = DecodeFailureTaskReasonTargetNotFound | DecodeFailureTaskReasonProgramBug

/** Decodeに失敗したという情報をrun()時まで保管するTask */
export class DecodeFailureTask<T> implements Task<T> {
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
  public run(obj: T): TaskProgressTypeFinished {
    return taskProgressTypeFinished
  }
}

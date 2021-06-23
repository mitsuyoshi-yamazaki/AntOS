// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type ResultType<T> = ResultSucceeded<T> | ResultFailed

export class ResultSucceeded<T> {
  public readonly resultType = "succeeded"

  public constructor(public readonly value: T) { }
}

export class ResultFailed {
  public readonly resultType = "failed"

  public constructor(public readonly error: Error) { }
}

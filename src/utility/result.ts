// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface Result<T> { resultType: "succeeded" | "failed" }

export type ResultType<T> = ResultSucceeded<T> | ResultFailed<T>

export class ResultSucceeded<T> implements Result<T> {
  public readonly resultType = "succeeded"

  public constructor(public readonly value: T) { }
}

export class ResultFailed<T> implements Result<T> {
  public readonly resultType = "failed"

  public constructor(public readonly error: Error) { }
}

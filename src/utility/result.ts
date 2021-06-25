export type ResultType<T, S> = ResultSucceeded<T> | ResultFailed<S>

export class ResultSucceeded<T> {
  public readonly resultType = "succeeded"
  public constructor(public readonly value: T) { }
}

export class ResultFailed<S> {
  public readonly resultType = "failed"
  public constructor(public readonly reason: S) { }
}

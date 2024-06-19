export type ResultSucceeded<T> = {
  readonly case: "succeeded"
  readonly value: T
}
export type ResultFailed<E> = {
  readonly case: "failed"
  readonly error: E
}
export type Result<T, E> = ResultSucceeded<T> | ResultFailed<E>

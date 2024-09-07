type ProcessErrorNotExecutable = {
  readonly case: "not_executable"
  readonly reason: string
}
type ProcessErrorTypes = ProcessErrorNotExecutable

export class ProcessError extends Error {
  public constructor(
    public readonly error: ProcessErrorTypes,
  ) {
    super(error.reason)
  }
}

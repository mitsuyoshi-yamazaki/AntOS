import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"

export function parseProcessId(args: string[]): ResultType<number> {
  if (args.length <= 0) {
    return new ResultFailed(new Error("Missing process ID argument"))
  }
  const processId = parseInt(args[0], 10)
  if (isNaN(processId)) {
    return new ResultFailed(new Error(`Invalid process ID argument ${args[0]}`))
  }
  return new ResultSucceeded(processId)
}

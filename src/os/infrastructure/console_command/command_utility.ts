import { Result } from "utility/result"

export function parseProcessId(args: string[]): Result<number, string> {
  if (args.length <= 0) {
    return Result.Failed("Missing process ID argument")
  }
  const processId = parseInt(args[0], 10)
  if (isNaN(processId)) {
    return Result.Failed(`Invalid process ID argument ${args[0]}`)
  }
  return Result.Succeeded(processId)
}

import { Result } from "utility/result"

export function parseProcessId(args: string[]): Result<number, string> {
  const rawProcessId = args[0]
  if (rawProcessId == null) {
    return Result.Failed("Missing process ID argument")
  }
  const processId = parseInt(rawProcessId, 10)
  if (isNaN(processId)) {
    return Result.Failed(`Invalid process ID argument ${rawProcessId}`)
  }
  return Result.Succeeded(processId)
}

import { Result } from "shared/utility/result"

export function parseProcessId(arg: string[] | string | undefined): Result<number, string> {
  const rawProcessId = ((): string | undefined => {
    if (arg == null) {
      return undefined
    }
    if (typeof arg === "string") {
      return arg
    }
    return arg[0]
  })()
  if (rawProcessId == null) {
    return Result.Failed("Missing process ID argument")
  }
  const processId = parseInt(rawProcessId, 10)
  if (isNaN(processId)) {
    return Result.Failed(`Invalid process ID argument ${rawProcessId}`)
  }
  return Result.Succeeded(processId)
}

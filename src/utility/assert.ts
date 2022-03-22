import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

interface Assert {
  assert(message: string): void
  assert(condition: boolean, message: string): void
}

export const Assert: Assert = {
  assert(...args: [string] | [boolean, string]): void {
    if (typeof args[0] === "string") {
      PrimitiveLogger.programError(args[0])
    } else {
      const [condition, message] = args as [boolean, string]
      if (condition === true) {
        return
      }
      PrimitiveLogger.programError(message)
    }
  },
}

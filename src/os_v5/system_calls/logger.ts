import { PrimitiveLogger, PrimitiveLogLevel } from "shared/utility/logger/primitive_logger"
import { SystemCall } from "../system_call"

type Logger = {
  log(message: string, level?: PrimitiveLogLevel): void
  notice(message: string): void
  fatal(message: string): void
  programError(message: string): void
}

export const Logger: SystemCall & Logger = {
  name: "logger",

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): void {
  },

  log(message: string, level?: PrimitiveLogLevel): void {
    PrimitiveLogger.log(message, level)
  },

  notice(message: string): void {
    PrimitiveLogger.notice(message)
  },

  /** ゲームの危機状態の通知 */
  fatal(message: string): void {
    PrimitiveLogger.fatal(message)
  },

  /** プログラムの問題の通知 */
  programError(message: string): void {
    PrimitiveLogger.programError(message)
  },
}

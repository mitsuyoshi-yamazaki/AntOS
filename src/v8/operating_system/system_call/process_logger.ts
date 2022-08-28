import { sanitizeLogMessage } from "os/infrastructure/primitive_logger"
import { coloredText, TextColor } from "utility/log"
import { Process } from "v8/process/process"
import { SystemCall } from "../system_call"

type LogLevel = "debug" | "info" | "warn" | "error" | "programError"

/** 常にnotify */
type UrgentLogOptions = {
  // 現在は空
}
type LogOptions = UrgentLogOptions & {
  readonly notify?: boolean
}

interface ProcessLoggerInterface extends SystemCall {
  debug(process: Process, message: string, options?: LogOptions): void
  info(process: Process, message: string, options?: LogOptions): void
  warn(process: Process, message: string, options?: LogOptions): void
  error(process: Process, message: string, options?: UrgentLogOptions): void
  programError(process: Process, message: string, options?: UrgentLogOptions): void

  log(process: Process, message: string, logLevel: LogLevel, options?: LogOptions): void
}

export const ProcessLogger: ProcessLoggerInterface = {
  // ---- Lifecycle ---- //
  // load(): void {
  // },

  // startOfTick(): void {
  // },

  // endOfTick(): void {
  // },

  // ---- Log ---- //
  debug(process: Process, message: string, options?: LogOptions): void {
    this.log(process, message, "debug", options)
  },

  info(process: Process, message: string, options?: LogOptions): void {
    this.log(process, message, "info", options)
  },

  warn(process: Process, message: string, options?: LogOptions): void {
    this.log(process, message, "warn", options)
  },

  error(process: Process, message: string, options?: UrgentLogOptions): void {
    this.log(process, message, "error", options)
  },

  programError(process: Process, message: string, options?: UrgentLogOptions): void {
    this.log(process, message, "programError", options)
  },

  log(process: Process, message: string, logLevel: LogLevel, options?: LogOptions): void {
    const logColor = ((): TextColor | "none" => {
      switch (logLevel) {
      case "debug":
        return "none"
      case "info":
        return "info"
      case "warn":
        return "warn"
      case "error":
        return "error"
      case "programError":
        return "critical"
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = logLevel
        return "error"
      }
      }
    })()
    const logMessage = `${coloredText(`[${logLevel}]`, logColor)} ${process.processId}: ${process.constructor.name} ${sanitizeLogMessage(message)}`

    // TODO:
    console.log(logMessage)
  },
}

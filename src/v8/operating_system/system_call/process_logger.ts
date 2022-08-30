import { sanitizeLogMessage } from "os/infrastructure/primitive_logger"
import { Process } from "v8/process/process"
import { SystemCall } from "../system_call"
import { LogLevel, LogOptions, PrimitiveLogger, UrgentLogOptions } from "../primitive_logger"

interface ProcessLoggerInterface extends SystemCall {
  debug(process: Process, message: string, options?: LogOptions): void
  info(process: Process, message: string, options?: LogOptions): void
  warn(process: Process, message: string, options?: LogOptions): void
  error(process: Process, message: string, options?: UrgentLogOptions): void
  programError(process: Process, message: string, options?: UrgentLogOptions): void

  log(process: Process, message: string, logLevel: LogLevel, options?: LogOptions): void
}

export const ProcessLogger: ProcessLoggerInterface = {
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
    const logMessage = `${process.processId}: ${process.constructor.name} ${sanitizeLogMessage(message)}`
    PrimitiveLogger.log(logMessage, logLevel, options)  // TODO: 適当に通知を間引く
  },
}

/**
 # PrimitiveLogger
 ## 概要
 SystemCallやKernelから呼び出される関係上、SystemCall interfaceを適用せず、独立運用可能な実装
 */

import { coloredText, TextColor } from "utility/log"

export type LogLevel = "debug" | "info" | "warn" | "error" | "programError"

/** 常にnotify */
export type UrgentLogOptions = {
  // 現在は空
}
export type LogOptions = UrgentLogOptions & {
  readonly notify?: boolean
}

export const PrimitiveLogger = {
  debug(message: string, options?: LogOptions): void {
    this.log(message, "debug", options)
  },

  info(message: string, options?: LogOptions): void {
    this.log(message, "info", options)
  },

  warn(message: string, options?: LogOptions): void {
    this.log(message, "warn", options)
  },

  error(message: string, options?: UrgentLogOptions): void {
    this.log(message, "error", {
      ...options,
      notify: true,
    })
  },

  programError(message: string, options?: UrgentLogOptions): void {
    this.log(message, "programError", {
      ...options,
      notify: true,
    })
  },

  log(message: string, logLevel: LogLevel, options?: LogOptions): void {
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
    const logMessage = `${coloredText(`[${logLevel}]`, logColor)} ${message}`
    const notify = ((): boolean => {
      if (options?.notify === true) {
        return true
      }
      if (logLevel === "error" || logLevel === "programError") {
        return true
      }
      return false
    })()

    console.log(logMessage)
    if (notify === true) {
      Game.notify(logMessage)
    }
  },
}

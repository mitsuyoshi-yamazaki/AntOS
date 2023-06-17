import { coloredText } from "utility/log"

export type PrimitiveLogLevel = "log" | "notice" | "fatal" | "program error"

/**
 * OSより低レベルでエラーが発生した際に使用する
 * TODO: LoggerもOS組み込みにするため将来的に消す
 * @deprecated
 */
export const PrimitiveLogger = {
  log(message: string, level?: PrimitiveLogLevel): void {
    switch (level) {
    case undefined:
    case "log":
      console.log(message)
      return

    case "notice":
      this.notice(message)
      return

    case "fatal":
      this.fatal(message)
      return

    case "program error":
      this.programError(message)
      return
    }
  },

  notice(message: string): void {
    console.log(message)
    Game.notify(message)
  },

  /** ゲームの危機状態の通知 */
  fatal(message: string): void {
    const coloredMessage = coloredText(message, "error")
    console.log(coloredMessage)
    Game.notify(coloredMessage)
  },

  /** プログラムの問題の通知 */
  programError(message: string): void {
    const coloredMessage = coloredText(`[Program bug]: ${message}`, "critical")
    console.log(coloredMessage)
    Game.notify(coloredMessage)
  },
}

export function sanitizeLogMessage(message: string): string {
  return message.replace("<", "&lt").replace(">", "&gt")
}

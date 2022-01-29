import { coloredText } from "utility/log"

/**
 * Processより低レベルでエラーが発生した際に使用する
 */
export const PrimitiveLogger = {
  log(message: string): void {
    log(message)
  },

  notice(message: string): void {
    log(message)
    notify(message)
  },

  /** ゲームの危機状態の通知 */
  fatal(message: string): void {
    const coloredMessage = coloredText(message, "error")
    log(coloredMessage)
    notify(coloredMessage)
  },

  /** プログラムの問題の通知 */
  programError(message: string): void {
    const coloredMessage = coloredText(`[Program bug]: ${message}`, "critical")
    log(coloredMessage)
    notify(coloredMessage)
  },
}

function log(message: string): void {
  console.log(sanitizeLogMessage(message))
}

function notify(message: string): void {
  Game.notify(sanitizeLogMessage(message))
}

export function sanitizeLogMessage(message: string): string {
  return message.replace("<", "&lt").replace(">", "&gt")
}

import { coloredText } from "utility/log"

/**
 * Processより低レベルでエラーが発生した際に使用する
 */
export const PrimitiveLogger = {
  log(message: string): void {
    console.log(message)
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

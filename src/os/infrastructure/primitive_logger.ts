import { coloredText } from "utility/log"

/**
 * Processより低レベルでエラーが発生した際に使用する
 */
export const PrimitiveLogger = {
  log: (message: string): void => {
    console.log(message)
  },

  fatal: (message: string): void => {
    const coloredMessage = coloredText(message, "critical")
    console.log(coloredMessage)
    Game.notify(coloredMessage)
  },
}

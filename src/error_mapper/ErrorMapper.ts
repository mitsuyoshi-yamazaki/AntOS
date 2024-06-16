import _ from "lodash"

export class ErrorMapper {
  public static wrapLoop<T>(loop: () => T, label?: string): () => T | null {
    return (): T | null => {
      try {
        return loop()
      } catch (error) {
        const errorMessageBody = ((): string => {
          if (error instanceof Error) {
            const stackTrace = error.stack
            if (stackTrace != null) {
              return `<span style='color:red'>${_.escape(stackTrace)}</span>`
            }
          }

          const stackTrace = (new Error()).stack
          if (stackTrace != null) {
            return `<span style='color:red'>${_.escape(stackTrace)}</span>`
          }
          return `<span style='color:red'>${error}</span>`
        })()

        const errorMessage = label == null ? errorMessageBody : `${label}\n${errorMessageBody}`

        console.log(errorMessage)
        Game.notify(errorMessage)

        return null
      }
    }
  }
}

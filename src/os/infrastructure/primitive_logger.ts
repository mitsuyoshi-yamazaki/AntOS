/**
 * Processより低レベルでエラーが発生した際に使用する
 */
export const PrimitiveLogger = {
  log: (message: string): void => {
    console.log(message)
  }
}

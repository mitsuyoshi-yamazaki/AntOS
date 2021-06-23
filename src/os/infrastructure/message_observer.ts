export interface MessageObserver {
  /**
   *
   * @param message
   * @returns 標準出力に表示する実行結果
   */
  didReceiveMessage(message: string): string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export function isMessageObserver(arg: any): arg is MessageObserver {
  return arg.didReceiveMessage !== undefined
}

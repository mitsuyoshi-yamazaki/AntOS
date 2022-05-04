// TODO: 汎用のmessageではなく型情報の入ったメッセージobserverのinterfaceをつくる（process launchableなど
export interface MessageObserver {
  didReceiveMessage(message: string): void
}

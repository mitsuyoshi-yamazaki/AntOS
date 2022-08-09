/**
 # SystemCall
 ## 概要
 > システムコールは、プログラムがオペレーティングシステムのカーネルにサービスを要求する方法です
 > https://www.scsk.jp/sp/sysdig/blog/sysdig/linux.html
 */

type SystemCallDefaultInterface = {
  load(): void
  startOfTick(): void
  endOfTick(): void
}

export type SystemCall = Partial<SystemCallDefaultInterface> & {
  readonly description: string
}

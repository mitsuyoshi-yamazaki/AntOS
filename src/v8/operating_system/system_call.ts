/**
 # SystemCall
 ## 概要
 > システムコールは、プログラムがオペレーティングシステムのカーネルにサービスを要求する方法です
 > https://www.scsk.jp/sp/sysdig/blog/sysdig/linux.html

 ## 要件
 - SystemCallはOS(Kernel)から使用するAPIとProcessから使用するAPIの二種類をもつ
   - [Optional] ProcessからはOSから使用するAPIが見えないようにしたい
 */

export type SystemCallDefaultInterface = {
  load(): void
  startOfTick(): void
  endOfTick(): void
}

export type SystemCall = Partial<SystemCallDefaultInterface>

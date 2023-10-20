/**
 # 概要
 - OSの稼働に必要なScreepsの低次機能を隠蔽する
 */
export abstract class SystemCall {
  public load(): void {
  }

  public startOfTick(): void {
  }

  public endOfTick(): void {
  }
}

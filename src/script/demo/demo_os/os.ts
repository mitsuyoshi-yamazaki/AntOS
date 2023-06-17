/**
 # 構造（要件）
 - プラットフォーム操作APIとしてSystemCall, Driverが用意される
   - SystemCallは相互に依存しない（のが望ましい。可能か？）
 - SystemCallを利用してOSが実装される
 - SystemCallとDriverを利用してProcessが実装される
   - →ProcessはSystemCallと依存するDriverへのアクセスが与えられている

 # 構造（仕様）
 - DriverはOSに渡す段階で固定して、ProcessはOSを経由してそのDriverへ依存するようにしたらどうか
   - → DIコンテナの使い所では
   - Driver群が固定されていると（Processが依存するDriverを指定していないと）シーズン間でのProcessの使い回しに不自由が出る
     - とはいえそれは実行前の段階の話なのでランタイムで条件分岐入れなくてもいいのでは
 - DriverもSystemCallとDriverに依存する
 - Processは依存するDriverとSystemCallの参照を持って生まれているべき
 */

import { AnyDriver, DriverSet } from "./driver"
import { SystemCall } from "./system_call"
import { ProcessManager } from "./process_manager"

export abstract class OperatingSystem<D extends AnyDriver> {
  private readonly processManager = new ProcessManager<D>()
  private readonly driverList: D[]

  public constructor(
    private readonly systemCall: SystemCall,
    private readonly drivers: DriverSet<D>,
  ) {
    this.driverList = Array.from(Object.values(drivers))
  }

  public load(): void {
    this.systemCall.load()
    this.processManager.load()
    this.driverList.forEach(driver => driver.load())
  }

  public startOfTick(): void {
    this.systemCall.startOfTick()
    this.processManager.startOfTick()
    this.driverList.forEach(driver => driver.startOfTick())
  }

  public endOfTick(): void {
    this.driverList.forEach(driver => driver.endOfTick())
    this.processManager.endOfTick()
    this.systemCall.endOfTick()
  }
}

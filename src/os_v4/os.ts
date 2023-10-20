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

import { SystemCall } from "./system_call"
import { ProcessManager } from "./process_manager"
import { SemanticVersion } from "../shared/utility/semantic_version"
import { SystemCallSet } from "./system_call_set"
import { AnyDriver, DriverSet } from "./driver"

export abstract class OperatingSystem<D extends AnyDriver> {
  public abstract readonly name: string

  protected readonly processManager = new ProcessManager<D>()
  protected readonly systemCallList: SystemCall[]
  protected readonly driverList: D[]

  public constructor(
    protected readonly systemCalls: typeof SystemCallSet,
    protected readonly drivers: DriverSet<D>,
    public readonly version: SemanticVersion,
  ) {
    this.systemCallList = Array.from(Object.values(systemCalls))
    this.driverList = Array.from(Object.values(drivers))
  }

  public load(): void {
    this.systemCallList.forEach(systemCall => systemCall.load())
    this.processManager.load()
    this.driverList.forEach(driver => driver.load())
  }

  public startOfTick(): void {
    this.systemCallList.forEach(systemCall => systemCall.startOfTick())
    this.processManager.startOfTick()
    this.driverList.forEach(driver => driver.startOfTick())
  }

  public endOfTick(): void {
    this.driverList.forEach(driver => driver.endOfTick())
    this.processManager.endOfTick()
    this.systemCallList.forEach(systemCall => systemCall.endOfTick())
  }
}

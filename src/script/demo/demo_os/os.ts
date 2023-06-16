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
 */

import { Driver } from "./driver"
import { SystemCall } from "./system_call"

declare namespace Tag {
  const OpaqueTagSymbol: unique symbol

  class OpaqueTag<T> {
    private [OpaqueTagSymbol]: T
  }
}
type ProcessId<T extends Process> = string & Tag.OpaqueTag<T>;

// ProcessのdependencyはDriverだけではなく親Processが渡す引数が入る可能性がある
// それをProcessManagerはどう平準化するか？
interface Process {
  readonly processId: ProcessId<this>
}

// ProcessからProcessManagerを呼び出す経路が循環しないようにする
class ProcessManager {
  private processes: Process[] = []

  public load(): void {
    this.restoreProcesses()
  }

  public startOfTick(): void {
  }

  public endOfTick(): void {
    this.storeProcesses()
  }

  public addProcess(process: Process): void {
  }

  public getProcess<P extends Process>(processId: ProcessId<P>): P | null {
    return null // TODO:
  }

  private restoreProcesses(): void {
  }

  private storeProcesses(): void {
  }
}

export abstract class OperatingSystem<S extends SystemCall> {
  private processManager = new ProcessManager()

  public constructor(
    public readonly systemCall: S,
    public readonly drivers: Driver[],
  ) {
  }

  public load(): void {
    this.systemCall.load()
    this.processManager.load()
    this.drivers.forEach(driver => driver.load())
  }

  public startOfTick(): void {
    this.systemCall.startOfTick()
    this.processManager.startOfTick()
    this.drivers.forEach(driver => driver.startOfTick())
  }

  public endOfTick(): void {
    this.drivers.forEach(driver => driver.endOfTick())
    this.processManager.endOfTick()
    this.systemCall.endOfTick()
  }
}

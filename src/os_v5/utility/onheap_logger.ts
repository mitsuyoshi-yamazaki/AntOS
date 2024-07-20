import { AnyProcess } from "os_v5/process/process"
import { Timestamp } from "shared/utility/timestamp"

export class OnHeapLogger {

  public constructor(
    public readonly process: AnyProcess,
    public readonly logCacheDuration: Timestamp,
  ) { }

  public clearOldLogs(): void {
  }

  public log(message: string): void {

  }
}

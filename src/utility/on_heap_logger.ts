import { PrimitiveLogger, PrimitiveLogLevel } from "os/infrastructure/primitive_logger"

type OptionalOptions = {
  readonly logLevel: PrimitiveLogLevel
  readonly logInterval?: number | null  // 同じメッセージでもcountがlogInterval件ごとにログを送出する
}
type Options = { [K in keyof OptionalOptions]: OptionalOptions[K] }

export class OnHeapLogger {
  private options: Options
  private logs = (new Map<string, number>())

  public constructor(
    options: Options,
  ) {
    this.options = {
      logLevel: options.logLevel,
      logInterval: options.logInterval ?? null,
    }
  }

  public add(message: string): void {
    const logCount = this.logs.get(message) ?? 0
    if (logCount <= 0) {
      this.log(message)
    } else {
      if (this.options.logInterval != null && (logCount % this.options.logInterval) === 0) {
        this.log(message)
      }
    }

    this.logs.set(message, logCount + 1)
  }

  public clear(): void {
    this.logs.clear()
  }

  public refresh(maxCount: number): void {
    if (this.logs.size > maxCount) {
      this.clear()
    }
  }

  private log(message: string): void {
    PrimitiveLogger.log(message, this.options.logLevel)
  }
}

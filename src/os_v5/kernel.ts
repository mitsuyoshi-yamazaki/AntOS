import { SystemCall } from "./system_call"
import { systemCallLifecycles, SystemCalls } from "./system_calls/interface"
import { Driver } from "./driver"
import { DriverFamily } from "./drivers/driver_family"
import { SemanticVersion } from "shared/utility/semantic_version"

type KernelMemory = {}

const reversedSystemCallLifecycles = [...systemCallLifecycles].reverse()

export const Kernel = {
  name: "AntOS",
  version: new SemanticVersion(5, 0, 0),
  launchedAt: Game.time,

  load(): void {
    // TODO: メモリ初期化

    systemCallLifecycles.forEach(systemCall => systemCall.load())
  },

  startOfTick(): void {
    systemCallLifecycles.forEach(systemCall => systemCall.startOfTick())
  },

  endOfTick(): void {
    reversedSystemCallLifecycles.forEach(systemCall => systemCall.endOfTick())
  },

  run(): void {
    // FixMe: デバッグ用
    if (Game.time % 10 === 0) {
      SystemCalls.logger.log(this.systemInfo())
    }
  },

  systemInfo(): string {
    const systemInfo: string[] = [
      `${this.name} ${this.version}`,
      `Launched at ${this.launchedAt} (${Game.time - this.launchedAt} ticks ago)`,
      "Environment: ", // TODO:
      "Available Drivers: ", // TODO:
    ]

    return systemInfo.join("\n")
  },
}

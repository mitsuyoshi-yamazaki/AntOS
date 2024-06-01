import { SystemCall } from "./system_call"
import { systemCallLifecycles, SystemCalls } from "./system_calls/interface"
import { Driver } from "./driver"
import { DriverFamily } from "./drivers/driver_family"
import { SemanticVersion } from "shared/utility/semantic_version"
import { initializeKernelMemory, KernelMemory } from "./kernel_memory"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

let kernelMemory: KernelMemory = {} as KernelMemory

const reversedSystemCallLifecycles = [...systemCallLifecycles].reverse()

export const Kernel = {
  name: "AntOS",
  version: new SemanticVersion(5, 0, 2),
  launchedAt: Game.time,

  load(memory: unknown): void {
    kernelMemory = initializeKernelMemory(memory)

    const versionName = `${this.version}`
    if (kernelMemory.version !== versionName) {
      kernelMemory.version = versionName

      SystemCalls.logger.log(`${ConsoleUtility.colored("Deployed", "info")} ${this.systemInfo()}`)
    }

    systemCallLifecycles.forEach(systemCall => {
      if (kernelMemory.systemCall[systemCall.name] == null) {
        kernelMemory.systemCall[systemCall.name] = {}
      }
      systemCall.load(kernelMemory.systemCall[systemCall.name])
    })
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
      ConsoleUtility.colored(`${this.name} ${this.version}`, "info"),
      `Launched at ${this.launchedAt} (${Game.time - this.launchedAt} ticks ago)`,
      "Environment: ", // TODO:
      "Available Drivers: ", // TODO:
    ]

    return systemInfo.join("\n")
  },
}

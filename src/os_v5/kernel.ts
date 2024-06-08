import { SystemCall } from "./system_call"
import { systemCallLifecycles, SystemCalls } from "./system_calls/interface"
import { Driver } from "./driver"
import { DriverFamily } from "./drivers/driver_family"
import { SemanticVersion } from "shared/utility/semantic_version"
import { initializeKernelMemory, KernelMemory } from "./kernel_memory"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { checkMemoryIntegrity } from "./utility/types"
import { StandardIO } from "./standard_io/standard_io"

let kernelMemory: KernelMemory = initializeKernelMemory({})

const reversedSystemCallLifecycles = [...systemCallLifecycles].reverse()

export const Kernel = {
  name: "AntOS",
  version: new SemanticVersion(5, 2, 0),
  launchedAt: {
    time: Game.time,
    datetime: new Date(),
  },

  load(memory: unknown): void {
    checkMemoryIntegrity(kernelMemory, initializeKernelMemory, "Kernel")
    kernelMemory = initializeKernelMemory(memory)

    const versionName = `${this.version}`
    let updated = false as boolean

    if (kernelMemory.version !== versionName) {
      kernelMemory.version = versionName
      updated = true
    }

    systemCallLifecycles.forEach(systemCall => {
      if (kernelMemory.systemCall[systemCall.name] == null) {
        kernelMemory.systemCall[systemCall.name] = {}
      }
      ErrorMapper.wrapLoop((): void => {
        systemCall.load(kernelMemory.systemCall[systemCall.name])
      }, "systemCall.load()")()
    })

    if (updated === true) {
      SystemCalls.logger.log(`${ConsoleUtility.colored("Deployed", "info")} ${this.systemInfo()}`)
    }
  },

  startOfTick(): void {
    systemCallLifecycles.forEach(systemCall => {
      ErrorMapper.wrapLoop((): void => {
        systemCall.startOfTick()
      }, "systemCall.startOfTick()")()
    })
  },

  endOfTick(): void {
    reversedSystemCallLifecycles.forEach(systemCall => {
      ErrorMapper.wrapLoop((): void => {
        systemCall.endOfTick()
      }, "systemCall.endOfTick()")()
    })
  },

  run(): void {
    // FixMe: デバッグ用
    if (Game.time % 30 === 0) {
      SystemCalls.logger.log(this.systemInfo())
    }
  },

  io(input: string): string {
    return StandardIO(input)
  },

  systemInfo(): string {
    const systemInfo: string[] = [
      ConsoleUtility.colored(`${this.name} ${this.version}`, "info"),
      `Launched at ${this.launchedAt.time} (${Game.time - this.launchedAt.time} ticks ago at ${this.launchedAt.datetime.toJSON()})`,
      `Environment: ${SystemCalls.environmentVariable.environment.name}`,
      "Available Drivers: ", // TODO:
    ]

    return systemInfo.join("\n")
  },
}

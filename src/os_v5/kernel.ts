import { systemCallLifecycles, SystemCalls } from "./system_calls/interface"
import { SemanticVersion } from "shared/utility/semantic_version"
import { initializeKernelMemory } from "./kernel_memory"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { StandardIO } from "./standard_io/standard_io"
import { KernelLifecycle } from "./kernel_lifecycle"
import { AnySerializable } from "./utility/types"
import { Timestamp } from "shared/utility/timestamp"
import { KernelMemory } from "./memory"
import { SystemCall } from "./system_call"

const reversedSystemCallLifecycles = [...systemCallLifecycles].reverse()
let kernelMemory: KernelMemory = {} as KernelMemory

type Kernel = {
  [Symbol.toStringTag]: "Kernel"
  readonly name: string
  readonly version: SemanticVersion
  readonly launchedAt: {
    readonly time: Timestamp
    readonly datetime: Date
  }

  run(): void
  systemInfo(): string
  io(input: string): string
}

export const Kernel: KernelLifecycle<KernelMemory> & Kernel = {
  [Symbol.toStringTag]: "Kernel",

  name: "AntOS",
  version: new SemanticVersion(5, 5, 34),
  launchedAt: {
    time: Game.time,
    datetime: new Date(),
  },

  load(memory: KernelMemory): void {
    kernelMemory = initializeKernelMemory(memory)

    const versionName = `${this.version}`
    let updated = false as boolean

    if (kernelMemory.version !== versionName) {
      kernelMemory.version = versionName
      updated = true
    }

    systemCallLifecycles.forEach(<SystemCallMemory extends AnySerializable>(systemCall: SystemCall<string, SystemCallMemory>) => {
      if (kernelMemory.systemCall[systemCall.name] == null) {
        kernelMemory.systemCall[systemCall.name] = {}
      }
      ErrorMapper.wrapLoop((): void => {
        systemCall.load(kernelMemory.systemCall[systemCall.name] as SystemCallMemory)
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

  endOfTick(): KernelMemory {
    reversedSystemCallLifecycles.forEach(systemCall => {
      ErrorMapper.wrapLoop((): void => {
        kernelMemory.systemCall[systemCall.name] = systemCall.endOfTick()
      }, "systemCall.endOfTick()")()
    })

    return kernelMemory
  },

  run(): void {
    systemCallLifecycles.forEach(systemCall => {
      ErrorMapper.wrapLoop((): void => {
        if (systemCall.run != null) {
          systemCall.run()
        }
      }, "systemCall.run()")()
    })
  },

  io(input: string): string {
    return StandardIO(input)
  },

  systemInfo(): string {
    const systemInfo: string[] = [
      ConsoleUtility.colored(`${this.name} ${this.version}`, "info"),
      `Launched at ${this.launchedAt.time} (${Game.time - this.launchedAt.time} ticks ago at ${this.launchedAt.datetime.toJSON()})`,
      `Environment: ${SystemCalls.environment.info.name}`,
    ]

    return systemInfo.join("\n")
  },
}

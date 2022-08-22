/**
 # Kernel
 ## 概要
 OSのコア機能を司る

 ## 機能
 - ドライバ管理
 - プロセス管理
 - Kernel管理下のsystem callのインターフェース提供

 ## プロセス管理
 プロセスは動的に起動される処理の単位

 ## ドライバ管理
 ドライバは将来的に動的に有効化することを見据えてKernelとは互いに依存（TSのimportを）しない実装

 ## Kernel管理下のsystem callのインターフェース提供
 Kernel管理下のsystem callのインターフェース `SystemCallInterface` を提供する

 - ProcessAccessor

 ## Discussion
 環境からの独立性
 仕組み上独立にできない項目
 - tick単位の計算
 - CPU usage
 */

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { } from "./kernel_memory"
import { Driver } from "./driver"
import { ProcessManager } from "./process_manager"
import { standardInput } from "./system_call/standard_input"
import { LaunchCommand } from "./system_call/standard_input_command/launch_command"
import { ProcessCommand } from "./system_call/standard_input_command/process_command"
import type { ProcessId } from "v8/process/process"
import type { ProcessType } from "v8/process/process_type"
import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"
import { StandardInputCommand } from "./system_call/standard_input_command"
import { SystemCall, SystemCallDefaultInterface } from "./system_call"

type LifecycleEvent = keyof SystemCallDefaultInterface

// const kernelConstants = {
//   driverMaxLoadCpu: 10,
// }

type KernelInterface = {
  // ---- Boot ---- //
  registerDrivers(drivers: Driver[]): void
  load(): void

  // ---- Every Ticks ---- //
  run(): void
}

type SystemCallLifecycleFunction = () => void

let lastCpuUse: number | null = null
const standardInputCommands = new Map<string, StandardInputCommand>([
  ["launch", new LaunchCommand((parentProcessId: ProcessId, processType: ProcessType, args: ArgumentParser) => ProcessManager.launchProcess(parentProcessId, processType, args))],
  ["process", new ProcessCommand()],
])

const driverFunctions: { [K in LifecycleEvent]: SystemCallLifecycleFunction[] } = {
  load: [],
  startOfTick: [],
  endOfTick: [],
}
const systemCallFunctions: { [K in LifecycleEvent]: SystemCallLifecycleFunction[] } = {
  load: [],
  startOfTick: [],
  endOfTick: [],
}
const systemCalls: SystemCall[] = [
  ProcessManager,
]
systemCalls.forEach(systemCall => {
  if (systemCall.load != null) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    systemCallFunctions.load.push(() => systemCall.load!())
  }
  if (systemCall.startOfTick != null) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    systemCallFunctions.startOfTick.push(() => systemCall.startOfTick!())
  }
  if (systemCall.endOfTick != null) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    systemCallFunctions.endOfTick.unshift(() => systemCall.endOfTick!())
  }
})

export const Kernel: KernelInterface = {
  registerDrivers(drivers: Driver[]): void {
    drivers.forEach(driver => {
      if (driver.load != null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        driverFunctions.load.push(() => driver.load!())
      }
      if (driver.startOfTick != null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        driverFunctions.startOfTick.push(() => driver.startOfTick!())
      }
      if (driver.endOfTick != null) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        driverFunctions.endOfTick.unshift(() => driver.endOfTick!())
      }
    })
  },

  load(): void {
    loadSystemCalls()
    loadDrivers()
  },

  run(): void {
    systemCallStartOfTick()
    driverStartOfTick()

    if (Game.time % 100 === 0) {
      PrimitiveLogger.log("v8 kernel.run()")  // FixMe: 消す
    }

    ProcessManager.runProcesses(lastCpuUse)

    driverEndOfTick()
    systemCallEndOfTick()

    lastCpuUse = Game.cpu.getUsed()
  },
}

const loadSystemCalls = (): void => {
  systemCallFunctions.load.forEach(f => {
    ErrorMapper.wrapLoop((): void => {
      f()
    })()
  })
}

const loadDrivers = (): void => {
  // const maxCpu = 10  // TODO:
  // const cpu = kernelConstants.driverMaxLoadCpu

  for(const load of driverFunctions.load) {
    ErrorMapper.wrapLoop((): void => {
      load()
    })()
    // if (Game.cpu.getUsed() - cpu > maxCpu) {
    //   break
    // }
  }
}

const systemCallStartOfTick = (): void => {
  ErrorMapper.wrapLoop((): void => {
    Game.v3 = standardInput(standardInputCommands)
  })()

  systemCallFunctions.startOfTick.forEach(f => {
    ErrorMapper.wrapLoop((): void => {
      f()
    })()
  })
}

const driverStartOfTick = (): void => {
  driverFunctions.startOfTick.forEach(f => {
    ErrorMapper.wrapLoop((): void => {
      f()
    })()
  })
}

const systemCallEndOfTick = (): void => {
  systemCallFunctions.endOfTick.forEach(f => {
    ErrorMapper.wrapLoop((): void => {
      f()
    })()
  })
}

const driverEndOfTick = (): void => {
  driverFunctions.endOfTick.forEach(f => {
    ErrorMapper.wrapLoop((): void => {
      f()
    })()
  })
}

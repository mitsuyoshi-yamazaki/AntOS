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
import { } from "./system_call/standard_input_command/process_command"
import type { ProcessId } from "v8/process/process"
import type { ProcessType } from "v8/process/process_type"
import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"

type LifecycleEventLoad = "load"
type LifecycleEventStartOfTick = "start_of_tick"
type LifecycleEventEndOfTick = "end_of_tick"
export type LifecycleEvent = LifecycleEventLoad | LifecycleEventStartOfTick | LifecycleEventEndOfTick
export const LifecycleEvent = {
  LifecycleEventLoad: "load" as LifecycleEventLoad,
  LifecycleEventStartOfTick: "start_of_tick" as LifecycleEventStartOfTick,
  LifecycleEventEndOfTick: "end_of_tick" as LifecycleEventEndOfTick,
}

const kernelConstants = {
  driverMaxLoadCpu: 10,
}

type KernelInterface = {
  registerDriverCall(events: LifecycleEvent[], driver: Driver): void

  run(): void
}

type ProcessAccessor = {
  // TODO:
}

type SystemCallInterface = {
  readonly process: ProcessAccessor
}

type DriverEventCall = () => void

let lastCpuUse: number | null = null
const driverCalls: { [K in LifecycleEvent]: DriverEventCall[] } = {
  load: [],
  start_of_tick: [],
  end_of_tick: [],
}
const standardInputCommands = [
  new LaunchCommand((parentProcessId: ProcessId, processType: ProcessType, args: ArgumentParser) => ProcessManager.launchProcess(parentProcessId, processType, args)),
]

export const Kernel: KernelInterface & SystemCallInterface = {
  process: {
  },

  registerDriverCall(events: LifecycleEvent[], driver: Driver): void {
    const register = (call: DriverEventCall | undefined, list: DriverEventCall[], description: string, reversed?: boolean): void => {
      if (call == null) {
        PrimitiveLogger.fatal(`${description} not implemented`)
        return
      }
      if (reversed === true) {
        list.unshift(call)
      } else {
        list.push(call)
      }
    }

    events.forEach(event => {
      const description = `${driver.description}.${event}`
      switch (event) {
      case LifecycleEvent.LifecycleEventLoad:
        register(driver.load, driverCalls.load, description)
        break
      case LifecycleEvent.LifecycleEventStartOfTick:
        register(driver.startOfTick, driverCalls.start_of_tick, description)
        break
      case LifecycleEvent.LifecycleEventEndOfTick:
        register(driver.endOfTick, driverCalls.end_of_tick, description, true)
        break
      }
    })
  },

  run(): void {
    systemCallStartOfTick()

    if (driverCalls.load.length > 0) {
      loadDrivers()
    }

    driverCalls.start_of_tick.forEach(call => {
      ErrorMapper.wrapLoop((): void => {
        call()
      })()
    })

    if (Game.time % 100 === 0) {
      PrimitiveLogger.log("v8 kernel.run()")  // FixMe: 消す
    }

    ProcessManager.runProcesses(lastCpuUse)

    driverCalls.end_of_tick.forEach(call => {
      ErrorMapper.wrapLoop((): void => {
        call()
      })()
    })

    lastCpuUse = Game.cpu.getUsed()
  },
}

const loadDrivers = (): void => {
  const maxCpu = 10
  const cpu = kernelConstants.driverMaxLoadCpu

  for(const load of driverCalls.load) {
    ErrorMapper.wrapLoop((): void => {
      load()
    })
    if (Game.cpu.getUsed() - cpu > maxCpu) {
      break
    }
  }
}

const systemCallStartOfTick = (): void => {
  ErrorMapper.wrapLoop((): void => {
    Game.v3 = standardInput(standardInputCommands)
  })()
}

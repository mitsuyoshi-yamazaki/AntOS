/**
 # Kernel
 ## 概要
 OSのコア機能である以下の機能を司る

 ### 機能
 - SystemCallとDriverのライフサイクルの管理
 - プロセスの実行

 ## SystemCallとDriver
 プロセスが任意に使用できる、メソッドをもつシングルトンオブジェクト
 以下のライフサイクルメソッドがKernelから呼び出される

 - load: OSのロード時（サーバーリセット）

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
import { Driver } from "./driver"
import { ProcessManager } from "./process_manager"
import { standardInput } from "./system_call/standard_input"
import { LaunchCommand } from "./system_call/standard_input_command/launch_command"
import { ProcessCommand } from "./system_call/standard_input_command/process_command"
import { KillCommand } from "./system_call/standard_input_command/kill_command"
import { DriverCommand, DriverInfoAccessor } from "./system_call/standard_input_command/driver_command"
import type { ProcessId } from "v8/process/process"
import type { ProcessType } from "v8/process/process_type"
import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"
import { StandardInputCommand } from "./system_call/standard_input_command"
import { SystemCall, SystemCallDefaultInterface } from "./system_call"
import { GameConstants } from "utility/constants"
import { ProcessLogger } from "./system_call/process_logger"
import { UniqueId } from "./system_call/unique_id"
import { isMessageObserver, MessageObserver } from "./message_observer"
import { DriverFamily } from "./driver_family/driver_family"
import { PrimitiveLogger } from "./primitive_logger"

type LifecycleEvent = keyof SystemCallDefaultInterface

type KernelInterface = {
  // ---- Boot ---- //
  standardInput: (command?: string) => string
  load(driverFamilies: DriverFamily[]): void

  // ---- Every Ticks ---- //
  run(): void
}

type SystemCallLifecycleFunction = () => void

const driverInfo = new Map<string, [string, string][]>()
const interactiveDrivers = new Map<string, SystemCall & MessageObserver>()
const driverInfoAccessor: DriverInfoAccessor = {
  listDriverInfo(): Map<string, [string, string][]> {
    return new Map(driverInfo)
  },

  getDriver(driverIdentifier: string): (Driver & MessageObserver) | null {
    return interactiveDrivers.get(driverIdentifier) ?? null
  },
}

const standardInputCommands = new Map<string, StandardInputCommand>([
  ["launch", new LaunchCommand((parentProcessId: ProcessId, processType: ProcessType, args: ArgumentParser) => ProcessManager.launchProcess(parentProcessId, processType, args))],
  ["process", new ProcessCommand()],
  ["kill", new KillCommand()],
  ["driver", new DriverCommand(driverInfoAccessor)],
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
  UniqueId,
  ProcessManager,
  ProcessLogger,
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
  standardInput: standardInput(standardInputCommands),

  load(driverFamilies: DriverFamily[]): void {
    callSystemCallFunctions(systemCallFunctions.load)
    callSystemCallFunctions(driverFunctions.load)

    registerDriverFamilies(driverFamilies)
  },

  run(): void {
    callSystemCallFunctions(systemCallFunctions.startOfTick)
    callSystemCallFunctions(driverFunctions.startOfTick)

    // Process実行時には全てのSystemCall, Driverが準備完了している必要がある
    ProcessManager.runProcesses(getProcessCpuLimit())

    callSystemCallFunctions(driverFunctions.endOfTick)
    callSystemCallFunctions(systemCallFunctions.endOfTick)
  },
}

const callSystemCallFunctions = (functions: (() => void)[]): void => {
  functions.forEach(f => {
    ErrorMapper.wrapLoop((): void => {
      f()
    })()
  })
}

const getProcessCpuLimit = (): number => {
  const usableBucket = Math.min(Game.cpu.bucket, GameConstants.game.cpu.limit)
  const estimatedSystemCallEndOfTick = 10
  const remainingCpu = Math.max(Game.cpu.limit - Game.cpu.getUsed() - estimatedSystemCallEndOfTick, 0)

  if (remainingCpu > 0) {
    return remainingCpu
  }

  if (usableBucket < 400) {
    return Math.min(remainingCpu, 5)
  }
  return remainingCpu
}

const registerDriverFamilies = (driverFamilies: DriverFamily[]): void => {
  driverInfo.clear()
  interactiveDrivers.clear()

  const interactiveDriverList: {
    familyName: string,
    shortName: string,
    drivers: (SystemCall & MessageObserver)[]
  }[] = []
  const shortDriverIdentifiers: string[] = [] // Driver Family Nameのついていない単体の名前
  const duplicatedDriverIdentifiers: string[] = []

  const interactiveSystemCalls: (SystemCall & MessageObserver)[] = []
  systemCalls.forEach(systemCall => {
    if (isMessageObserver(systemCall)) {
      interactiveSystemCalls.push(systemCall)
      if (shortDriverIdentifiers.includes(systemCall.identifier) === true) {
        PrimitiveLogger.programError(`duplicated system call identifier: ${systemCall.identifier}`)
      } else {
        shortDriverIdentifiers.push(systemCall.identifier)
      }
    }
  })

  driverFamilies.forEach(family => {
    const drivers: (SystemCall & MessageObserver)[] = []
    family.drivers.forEach(driver => {
      if (isMessageObserver(driver)) {
        drivers.push(driver)
        if (shortDriverIdentifiers.includes(driver.identifier) === true) {
          duplicatedDriverIdentifiers.push(driver.identifier)
        } else {
          shortDriverIdentifiers.push(driver.identifier)
        }
      }

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

    interactiveDriverList.push({
      familyName: family.name,
      shortName: family.shortName,
      drivers,
    })
  })

  const systemCallInfo: [string, string][] = []
  interactiveSystemCalls.forEach(systemCall => {
    interactiveDrivers.set(systemCall.identifier, systemCall)
    systemCallInfo.push([systemCall.identifier, systemCall.description])
  })
  driverInfo.set("SystemCall", systemCallInfo)

  interactiveDriverList.forEach(family => {
    const info: [string, string][] = []

    family.drivers.forEach(driver => {
      const identifiers: string[] = []

      const identifier = `${family.shortName}.${driver.identifier}`
      interactiveDrivers.set(identifier, driver)
      identifiers.push(identifier)

      if (duplicatedDriverIdentifiers.includes(driver.identifier) !== true) {
        interactiveDrivers.set(driver.identifier, driver)
        identifiers.push(driver.identifier)
      }

      info.push([identifiers.join(", "), driver.description])
    })

    driverInfo.set(family.familyName, info)
  })
}

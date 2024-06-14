import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { Process, ProcessId } from "os_v5/process/process"
import { Command } from "../command"

// Processes
import { TestProcess, TestProcessId } from "../../processes/test_process"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"

type ProcessType = string

export const ProcessLauncher: Command = {
  /** @throws */
  help(): string {
    return "launch {process type} ...{arguments}"
  },

  /** @throws */
  run(args: string[]): string {
    const processType = args.shift()

    if (processType == null || processType.length <= 0) {
      return this.help([])
    }

    return launchProcess(processType, args)
  },
}


// TODO: argument parserはOS向けに拡張可能な（任意のゲームオブジェクトをパースするような）もの + キーワード引数と配列を同時にパースできるものを作成する


// Process Launcher
type ProcessConstructor = <D, I, M, P extends Process<D, I, M, P>>(processId: ProcessId<D, I, M, P>) => P
type ConstructorMaker = (args: string[]) => ProcessConstructor

const constructorMakers = new Map<ProcessType, ConstructorMaker>()

const registerProcess = (processType: ProcessType, launcher: ConstructorMaker): void => {
  try {
    if (constructorMakers.has(processType) === true) {
      PrimitiveLogger.programError(`Process ${processType} is registered multiple times`)
      return
    }
    constructorMakers.set(processType, launcher)
  } catch (error) {
    PrimitiveLogger.fatal(`An exception raised while process ${processType} is being registered: ${error}`)
  }
}

/** @throws */
const launchProcess = (processType: ProcessType, args: string[]): string => {
  const constructorMaker = constructorMakers.get(processType)
  if (constructorMaker == null) {
    throw `Unregistered process type ${processType}`
  }

  const constructor = constructorMaker(args)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const process = ProcessManager.addProcess<any, any, any, any>(constructor)

  return `Launched [${process.processId}] ${processType} ${process.shortDescription()}`
}


// Process Registration
registerProcess("TestProcess", () => {
  return ((processId: TestProcessId): TestProcess => {
    return TestProcess.create(processId)
  }) as ProcessConstructor
})

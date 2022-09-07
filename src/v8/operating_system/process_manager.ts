/**
 # ProcessManager
 ## 概要
 Processの管理を行い、対外的にprocess全体に対する操作インターフェースを提供する

 ## TODO
 Process Managerは使えるCPU時間をprocessに通知し、超過した場合の処理を行い、逆にprocessから通知された優先順位に基づいてprocess実行順を入れ替えたりするものになる
 */

import { ProcessId, Process } from "../process/process"
import { SystemCall } from "./system_call"
import { ExternalProcessInfo, ProcessInfo, ProcessStore, RunningProcess } from "./process_store"
import { EnvironmentalVariables } from "./environmental_variables"
import { ProcessType, ProcessTypeConverter, rootProcessId } from "v8/process/process_type"
import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"
import { isLauncherProcess } from "v8/process/message_observer/launch_message_observer"
import { ProcessInfoMemory } from "./kernel_memory"
import { ApplicationProcessLauncher } from "v8/process/application_process_launcher"
import { ApplicationProcessDecoder } from "v8/process/application_process_decoder"
import { UniqueId } from "./system_call/unique_id"
import { PrimitiveLogger } from "./primitive_logger"

interface ProcessManagerExternal {
  // ---- Accessor ---- //
  getChildProcesses(processId: ProcessId): RunningProcess[]
  processInfoOf(processId: ProcessId): { parentProcessId: ProcessId, running: boolean } | null
  pauseProcess(processId: ProcessId): void
  resumeProcess(processId: ProcessId): void

  // ---- Lifecycle ---- //
  addProcess(process: Process, parentProcessId: ProcessId): void
  removeProcess(processId: ProcessId): void
}

interface ProcessManagerInterface extends SystemCall, ProcessManagerExternal {
  /**
   * @param cpuLimit 今tickで使用可能なCPU時間の上限
   */
  runProcesses(cpuLimit: number): void

  /** @throws */
  launchProcess(parentProcessId: ProcessId, processType: ProcessType, args: ArgumentParser): Process

  // ---- Standard IO ---- //
  listProcesses(): ExternalProcessInfo[]
}

const processManagerMemory = EnvironmentalVariables.kernelMemory.process

export const ProcessManager: ProcessManagerInterface = {
  identifier: "ProcessManager",
  description: "manages processes",

  // ---- Accessor ---- //
  getChildProcesses(processId: ProcessId): RunningProcess[] {
    const childProcessInfo = ProcessStore.childProcessInfo(processId) ?? []
    return childProcessInfo.map(processInfo => processInfo.process)
  },

  processInfoOf(processId: ProcessId): ExternalProcessInfo | null {
    return ProcessStore.processInfo(processId)
  },

  pauseProcess(processId: ProcessId): void {
    const processInfo = ProcessStore.processInfo(processId)
    if (processInfo == null) {
      return
    }
    processInfo.running = false
  },

  resumeProcess(processId: ProcessId): void {
    const processInfo = ProcessStore.processInfo(processId)
    if (processInfo == null) {
      return
    }
    processInfo.running = true
  },

  // ---- Lifecycle ---- //
  addProcess(process: Process, parentProcessId: ProcessId): void {
    addProcess(process, parentProcessId)
  },

  removeProcess(processId: ProcessId): void {
    removeProcess(processId)
  },

  // ---- OS API ---- //
  load(): void {
    decodeProcesses()
  },

  // startOfTick(): void {
  // },

  endOfTick(): void {
    encodeProcesses()
  },

  runProcesses(cpuLimit: number): void {
    runProcesses()
  },

  /** @throws */
  launchProcess(parentProcessId: ProcessId, processType: ProcessType, args: ArgumentParser): Process {
    const process = ((): Process => {
      if (parentProcessId === ProcessStore.rootProcess.processId) {
        return launchProcessOnRoot(processType, args)
      }

      const parentProcess = ProcessStore.processInfo(parentProcessId)?.process
      if (parentProcess == null) {
        throw `no parent process with ID ${parentProcessId}`
      }

      if (!isLauncherProcess(parentProcess)) {
        throw `${parentProcess.constructor.name} doesn't have child processes`
      }

      return parentProcess.didReceiveLaunchMessage(processType, args)
    })()

    this.addProcess(process, parentProcessId)
    return process
  },

  // ---- Standard IO ---- //
  listProcesses(): ExternalProcessInfo[] {
    return ProcessStore.allProcesses()
  },
} as const

/** @throws */
const launchProcessOnRoot = (processType: ProcessType, args: ArgumentParser): Process => {
  return ApplicationProcessLauncher.launch(processType, args)
}

const assignProcessId = (process: Process, processId: ProcessId, options?: {noLog?: boolean}): RunningProcess => {
  (process as unknown as { _processId: ProcessId })._processId = processId
  if (options?.noLog !== true) {
    PrimitiveLogger.info(`assign process ${process.constructor.name} ${process.processId}`)
  }
  return process as RunningProcess
}

const resignProcessId = (process: RunningProcess): Process => {
  PrimitiveLogger.info(`resign process ${process.constructor.name} ${process.processId}`);
  (process as unknown as { _processId: ProcessId | null })._processId = null
  return process
}

const newProcessId = (): ProcessId => {
  const processId: ProcessId = `p${UniqueId.generateFromInteger(processManagerMemory.processIdIndex) }`
  processManagerMemory.processIdIndex += 1
  return processId
}

const addProcess = (process: Process, parentProcessId: ProcessId): void => {
  if (process.processId != null) {
    PrimitiveLogger.programError(`ProcessManager.addProcess() received a running process ${process.constructor.name} ${process.processId}`)
    return
  }

  const runningProcess = assignProcessId(process, newProcessId())
  const processInfo: ProcessInfo = {
    process: runningProcess,
    parentProcessId,
    running: true,
  }

  ProcessStore.addProcess(processInfo)
}

const removeProcess = (processId: ProcessId): void => {
  const processInfo = ProcessStore.processInfo(processId)
  if (processInfo == null) {
    return
  }
  unloadRecursively(processInfo)
  removeProcessRecursively(processInfo)
}

const unloadRecursively = (processInfo: ProcessInfo): void => {
  const process = processInfo.process
  if (process.unload != null) {
    process.unload(process.processId)
  }

  (ProcessStore.childProcessInfo(process.processId) ?? []).forEach(childProcessInfo => {
    unloadRecursively(childProcessInfo)
  })
}

const removeProcessRecursively = (processInfo: ProcessInfo): void => {
  (ProcessStore.childProcessInfo(processInfo.process.processId) ?? []).forEach(childProcessInfo => {
    removeProcessRecursively(childProcessInfo)
  })

  ProcessStore.removeProcess(processInfo)
  resignProcessId(processInfo.process)
}

const decodeProcesses = (): void => {
  if (ProcessStore.allProcesses().length > 0) {
    PrimitiveLogger.programError(`decodeProcesses ${ProcessStore.allProcesses().length} processes`)
    return
  }

  processManagerMemory.processInfoMemories.forEach(processInfoMemory => {
    const process = ApplicationProcessDecoder.decode(processInfoMemory.s)
    if (process == null) {
      return
    }
    const runningProcess = assignProcessId(process, processInfoMemory.i, {noLog: true})
    const processInfo: ProcessInfo = {
      process: runningProcess,
      running: processInfoMemory.r,
      parentProcessId: rootProcessId,
    }

    ProcessStore.addProcess(processInfo)

    recursivelyDecodeProcesses(runningProcess, processInfoMemory.c)
  })

  ProcessStore.allProcesses().forEach(processInfo => {
    const process = processInfo.process
    if (process.load == null) {
      return
    }
    process.load(process.processId)
  })
}

const recursivelyDecodeProcesses = (parentProcess: RunningProcess, childProcessInfoMemories: ProcessInfoMemory[]): void => {
  childProcessInfoMemories.forEach(processInfoMemory => {
    const processType = ProcessTypeConverter.revert(processInfoMemory.s.t)
    const process = parentProcess.decodeChildProcess(processType, processInfoMemory.s)
    if (process == null) {
      PrimitiveLogger.programError(`${parentProcess.processId} ${parentProcess.constructor.name} cannot decode ${processType}`)
      return
    }
    const runningProcess = assignProcessId(process, processInfoMemory.i, {noLog: true})
    const processInfo: ProcessInfo = {
      process: runningProcess,
      running: processInfoMemory.r,
      parentProcessId: parentProcess.processId,
    }

    ProcessStore.addProcess(processInfo)

    recursivelyDecodeProcesses(runningProcess, processInfoMemory.c)
  })
}

const encodeProcesses = (): void => {
  const applicationProcesses = ProcessStore.childProcessInfo(rootProcessId) ?? []
  processManagerMemory.processInfoMemories = recursivelyEncodeProcess(applicationProcesses)
}

const recursivelyEncodeProcess = (processInfo: ProcessInfo[]): ProcessInfoMemory[] => {
  return processInfo.map(info => ({
    i: info.process.processId,
    r: info.running,
    s: info.process.encode(),
    c: recursivelyEncodeProcess(ProcessStore.childProcessInfo(info.process.processId) ?? []),
  }))
}

const runProcesses = (): void => {
  ProcessStore.rootProcess.run()
  const childProcesses = ProcessStore.childProcessInfo(ProcessStore.rootProcess.processId)
  if (childProcesses == null) {
    return
  }

  // TODO: CPU time management実装する
  childProcesses.forEach(childProcessInfo => runProcessRecursively(childProcessInfo))
}

const runProcessRecursively = (processInfo: ProcessInfo): void => {
  if (processInfo.running !== true) {
    return
  }

  const processId = processInfo.process.processId
  processInfo.process.run(processId)
  const childProcesses = ProcessStore.childProcessInfo(processId)
  if (childProcesses == null) {
    return
  }

  childProcesses.forEach(childProcessInfo => runProcessRecursively(childProcessInfo))
}

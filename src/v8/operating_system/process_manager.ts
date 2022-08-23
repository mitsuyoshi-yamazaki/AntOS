/**
 # ProcessManager
 ## 概要
 Processの管理を行い、対外的にprocess全体に対する操作インターフェースを提供する

 ## TODO
 Process Managerは使えるCPU時間をprocessに通知し、超過した場合の処理を行い、逆にprocessから通知された優先順位に基づいてprocess実行順を入れ替えたりするものになる
 */

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { UniqueId } from "utility/unique_id"
import { ProcessId, Process } from "../process/process"
import { SystemCall } from "./system_call"
import { ExternalProcessInfo, ProcessInfo, ProcessStore, RunningProcess } from "./process_store"
import { EnvironmentalVariables } from "./environmental_variables"
import { ProcessType } from "v8/process/process_type"
import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"
import { isLauncherProcess } from "v8/process/message_observer/launch_message_observer"
import { ProcessInfoMemory } from "./kernel_memory"
import { ProcessDecoder } from "v8/process/process_decoder"
import { ApplicationProcessLauncher } from "v8/process/application_process_launcher"

interface ProcessManagerExternal {
  // ---- Accessor ---- //
  processInfoOf(processId: ProcessId): { parentProcessId: ProcessId, running: boolean } | null
  pauseProcess(processId: ProcessId): void
  resumeProcess(processId: ProcessId): void

  // ---- Lifecycle ---- //
  addProcess(process: Process, parentProcessId: ProcessId): void
  removeProcess(processId: ProcessId): void
}

interface ProcessManagerInterface extends SystemCall, ProcessManagerExternal {
  runProcesses(lastCpuUse: number | null): void

  /** @throws */
  launchProcess(parentProcessId: ProcessId, processType: ProcessType, args: ArgumentParser): Process

  // ---- Standard IO ---- //
  listProcesses(): ProcessInfo[]
}

const processManagerMemory = EnvironmentalVariables.kernelMemory.process

export const ProcessManager: ProcessManagerInterface = {
  // ---- Accessor ---- //
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
    const processInfo = ProcessStore.processInfo(processId)
    if (processInfo == null) {
      return
    }
    ProcessStore.removeProcess(processInfo)
    resignProcessId(processInfo.process)
  },

  // ---- OS API ---- //
  description: "manages process lifecycle and execution",

  load(): void {
    decodeProcesses()
  },

  // startOfTick(): void {
  // },

  endOfTick(): void {
    encodeProcesses()
  },

  runProcesses(lastCpuUse: number | null): void { // TODO:
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
  listProcesses(): ProcessInfo[] {
    return ProcessStore.allProcesses()
  },
} as const

/** @throws */
const launchProcessOnRoot = (processType: ProcessType, args: ArgumentParser): Process => {
  return ApplicationProcessLauncher.launch(processType, args)
}

const assignProcessId = (process: Process, processId: ProcessId): RunningProcess => {
  (process as unknown as { _processId: ProcessId })._processId = processId
  return process as RunningProcess
}

const resignProcessId = (process: RunningProcess): Process => {
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

const decodeProcesses = (): void => {
  if (ProcessStore.allProcesses().length > 0) {
    PrimitiveLogger.programError(`decodeProcesses ${ProcessStore.allProcesses().length} processes`)
    return
  }

  Array.from(Object.entries(processManagerMemory.processInfoMemories)).forEach(([parentProcessId, processStateList]) => {
    processStateList.forEach(processState => {
      const process = ProcessDecoder.decode(processState.s)
      if (process == null) {
        return
      }
      const runningProcess = assignProcessId(process, processState.i)
      const processInfo: ProcessInfo = {
        process: runningProcess,
        running: processState.r,
        parentProcessId,
      }

      ProcessStore.addProcess(processInfo)
    })
  })
}

const encodeProcesses = (): void => {
  const allProcessState: { [ParentProcessId: string]: ProcessInfoMemory[] } = {}

  Array.from(ProcessStore.processListByParentId().entries()).forEach(([parentProcessId, processInfoList]) => {
    if (processInfoList.length <= 0) {
      return
    }
    allProcessState[parentProcessId] = processInfoList.map(processInfo => ({
      i: processInfo.process.processId,
      r: processInfo.running,
      s: processInfo.process.encode(),
    }))
  })

  processManagerMemory.processInfoMemories = allProcessState
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

  processInfo.process.run()
  const childProcesses = ProcessStore.childProcessInfo(processInfo.process.processId)
  if (childProcesses == null) {
    return
  }

  childProcesses.forEach(childProcessInfo => runProcessRecursively(childProcessInfo))
}

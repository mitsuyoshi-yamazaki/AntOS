import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ValuedArrayMap } from "utility/valued_collection"
import { Process, ProcessId } from "v8/process/process"
import { ProcessType } from "v8/process/process_type"
import { RootProcess } from "v8/process/root_process"

export type RunningProcess = Process & { processId: ProcessId }

export type ExternalProcessInfo = {
  readonly parentProcessId: ProcessId
  readonly running: boolean
}

export type ProcessInfo = {
  readonly parentProcessId: ProcessId
  running: boolean
  readonly process: RunningProcess
}

const processes = new Map<ProcessId, ProcessInfo>()
const processesByParent = new ValuedArrayMap<ProcessId, ProcessInfo>()
const processesByType = new ValuedArrayMap<ProcessType, ProcessInfo>()

export const ProcessStore = {
  rootProcess: new RootProcess(),

  processInfo(processId: ProcessId): ProcessInfo | null {
    return processes.get(processId) ?? null
  },

  childProcessInfo(parentProcessId: ProcessId): ProcessInfo[] | null {
    const children = processesByParent.get(parentProcessId)
    if (children == null) {
      return null
    }
    return [...children]
  },

  addProcess(processInfo: ProcessInfo): void {
    const processId = processInfo.process.processId
    if (processes.has(processId) === true) {
      PrimitiveLogger.programError(`ProcessStore.addProcess() received an existing process ${processInfo.process.constructor.name} ${processId}`)
      return
    }

    processes.set(processId, processInfo)
    processesByParent.getValueFor(processInfo.parentProcessId).push(processInfo)
    processesByType.getValueFor(processInfo.process.processType).push(processInfo)
  },

  removeProcess(processInfo: ProcessInfo): void {
    const processId = processInfo.process.processId
    if (processes.has(processId) !== true) {
      PrimitiveLogger.programError(`ProcessStore.removeProcess() received an unknown process ${processInfo.process.constructor.name} ${processId}`)
      return
    }

    processes.delete(processId)
    removeProcessInfoFrom(processesByParent.getValueFor(processInfo.parentProcessId), processInfo)
    removeProcessInfoFrom(processesByType.getValueFor(processInfo.process.processType), processInfo)
  },
} as const

const removeProcessInfoFrom = (processInfoList: ProcessInfo[], processInfo: ProcessInfo): void => {
  const index = processInfoList.indexOf(processInfo)
  if (index < 0) {
    PrimitiveLogger.programError(`Given processInfo not found in the list ${processInfo.process.constructor.name} ${processInfo.process.processId}`)
    return
  }

  processInfoList.splice(index, 1)
}

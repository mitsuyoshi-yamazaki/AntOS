import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { Mutable } from "shared/utility/types"
import { AnyProcess, AnyProcessId, Process, ProcessId } from "../../process/process"
import { processTypeDecodingMap, processTypeEncodingMap } from "../../process/process_type_map"
import { SystemCall } from "os_v5/system_call"
import { SerializableObject } from "os_v5/utility/types"
import { UniqueId } from "../unique_id"
import { SharedMemory } from "./shared_memory"
import { ProcessStore } from "./process_store"
import { ProcessDecoder, ProcessState } from "./process_decoder"
import { ProcessManagerError } from "./process_manager_error"
import { DependencyGraphNode } from "./process_dependency_graph"
import { ProcessExecutionLog } from "./process_execution_log"


/**
# ProcessManager
## 概要

## TODO
- suspend理由を保存する
  - 他のsuspend理由がなくなっても手動でsuspendしたProcessは復帰させない
  - 状態
    - 手動でsuspend
      - 手動でのみresume
    - 依存Processがsuspend
      - resumeで自動でresume (a)
    - 依存Processがkill
      - 新たにlaunchされたらresume (b)
    - aとbは区別する必要はない
 */


export type ProcessRunningState = {
  readonly isRunning: boolean
}


type ProcessManagerMemory = {
  processes: ProcessState[] // 順序を崩さないために配列とする
  suspendedProcessIds: string[]
  noDependencyProcessIds: string[]
}


const initializeMemory = (memory: ProcessManagerMemory): ProcessManagerMemory => {
  const mutableMemory = memory as Mutable<ProcessManagerMemory>

  if (mutableMemory.processes == null) {
    mutableMemory.processes = []
  }
  if (mutableMemory.suspendedProcessIds == null) {
    mutableMemory.suspendedProcessIds = []
  }
  if (mutableMemory.noDependencyProcessIds == null) {
    mutableMemory.noDependencyProcessIds = []
  }

  return mutableMemory
}


let processManagerMemory: ProcessManagerMemory = {} as ProcessManagerMemory
const processStore = new ProcessStore()
const processExecutionLogs: ProcessExecutionLog[] = []


type ProcessManager = {
  addProcess<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P
  getProcess<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null
  getProcessRunningState(processId: AnyProcessId): ProcessRunningState
  suspend(process: AnyProcess): boolean
  resume(process: AnyProcess): boolean
  killProcess(process: AnyProcess): void
  getRuntimeDescription<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): string | null
  listProcesses(): AnyProcess[]
  listProcessRunningStates(): Readonly<ProcessRunningState & { process: AnyProcess }>[]
  getDependingProcessGraphRecursively(processId: AnyProcessId): DependencyGraphNode | null

  /** @throws */
  sendMessage<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P, args: string[]): string
}


export const ProcessManager: SystemCall<"ProcessManager", ProcessManagerMemory> & ProcessManager = {
  name: "ProcessManager",
  [Symbol.toStringTag]: "ProcessManager",

  load(memory: ProcessManagerMemory): void {
    processManagerMemory = initializeMemory(memory)

    restoreProcesses(processManagerMemory.processes).forEach(process => {
      processStore.add(process, {skipSort: true})
    })
    processStore.sortProcessList()
    processStore.setSuspendedProcessIds(processManagerMemory.suspendedProcessIds as AnyProcessId[])
  },

  startOfTick(): void {
    SharedMemory.startOfTick()
  },

  endOfTick(): ProcessManagerMemory {
    processManagerMemory.processes = storeProcesses(processStore.listProcesses())
    processManagerMemory.suspendedProcessIds = processStore.getSuspendedProcessIds()
    return processManagerMemory
  },

  run(): void {
    const executionLog: Mutable<ProcessExecutionLog> = {
      time: Game.time,
      iteratedProcessId: null,
      iterateFinished: false,
      errorRaised: new Set(),
    }
    processExecutionLogs.unshift(executionLog)

    const processRunAfterTicks: (() => void)[] = []

    processStore.listProcesses().forEach(<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P) => {
      ErrorMapper.wrapLoop((): void => {
        try {
          executionLog.iteratedProcessId = process.processId

          const runningState = this.getProcessRunningState(process.processId)
          if (runningState.isRunning !== true) {
            return
          }

          const dependency = process.getDependentData(SharedMemory)
          if (dependency === null) { // Dependencyがvoidでundefinedが返る場合を除外するため
            PrimitiveLogger.log(`ProcessManager.run(${process}): no dependent data. Suspending...`)
            processStore.setMissingDependency(process.processId)
            return
          }

          const processMemory = process.run(dependency)
          SharedMemory.set(process.processType, process.identifier, processMemory)

          if (process.runAfterTick != null) {
            processRunAfterTicks.push((() => {
              ErrorMapper.wrapLoop((): void => {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                process.runAfterTick!(dependency)
              }, `ProcessManager.runAfterTick(${process})`)()
            }))
          }
        } catch (error) {
          executionLog.errorRaised.add(process.processId)
          if (processExecutionLogs[1]?.errorRaised.has(process.processId) === true) {
            processStore.suspend(process.processId)
            PrimitiveLogger.fatal(`ProcessManager.run(${process}): raised error twice. Suspending...`)
          }
          throw error
        }
      }, `ProcessManager.run(${process})`)()
    })

    executionLog.iterateFinished = true
    if (processExecutionLogs.length > 2) {
      processExecutionLogs.splice(2, processExecutionLogs.length - 2)
    }

    processRunAfterTicks.forEach(runAfterTick => runAfterTick())
  },

  // ProcessManager
  /** @throws */
  addProcess<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P {
    // 依存先含めて作成する場合も静的に制約できないため例外を送出するのは変わらない
    // 依存状況は依存先をkillする際に辿らなければならないため、Process単位で接続している必要がある
    // 依存元はProcessではなくデータに依存しているが、そのデータは依存先Processが作っている

    const process = constructor(createNewProcessId())

    const processWithSameIdentifier: AnyProcess | null = processStore.getProcessByIdentifier(process.processType, process.identifier)
    if (processWithSameIdentifier != null) {
      throw new ProcessManagerError({
        case: "already launched",
        processType: process.processType,
        identifier: process.identifier,
        existingProcessId: processWithSameIdentifier.processId,
      })
    }

    const { missingDependencies } = processStore.checkDependencies(process.dependencies.processes)
    if (missingDependencies.length > 0) {
      throw new ProcessManagerError({
        case: "lack of dependencies",
        missingDependencies: missingDependencies
      })
    }

    processStore.add(process)

    if (process.didLaunch != null) {
      process.didLaunch()
    }

    return process
  },

  getProcess<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
    return processStore.getProcessById(processId)
  },

  getProcessRunningState(processId: AnyProcessId): ProcessRunningState {
    return {
      isRunning: processStore.isProcessSuspended(processId) !== true,
    }
  },

  suspend(process: AnyProcess): boolean {
    return processStore.suspend(process.processId)
  },

  resume(process: AnyProcess): boolean {
    return processStore.resume(process.processId)
  },

  killProcess(process: AnyProcess): void {
    if (process.willTerminate != null) {
      process.willTerminate()
    }

    processStore.remove(process)
  },

  getRuntimeDescription<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): string | null {
    return ErrorMapper.wrapLoop((): string | null => {
      const dependency = process.getDependentData(SharedMemory)
      if (dependency === null) { // Dependencyがvoidでundefinedが返る場合を除外するため
        return null
      }
      return process.runtimeDescription(dependency)

    }, `ProcessManager.getRuntimeDescription(${process.processType})`)()
  },

  listProcesses(): AnyProcess[] {
    return processStore.listProcesses()
  },

  listProcessRunningStates(): Readonly<ProcessRunningState & { process: AnyProcess }>[] {
    return this.listProcesses().map((process): ProcessRunningState & { process: AnyProcess } => {
      return {
        process,
        ...this.getProcessRunningState(process.processId),
      }
    })
  },

  getDependingProcessGraphRecursively(processId: AnyProcessId): DependencyGraphNode | null {
    return processStore.getDependingProcessGraphRecursively(processId)
  },

  /** @throws */
  sendMessage<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P, args: string[]): string {
    if (process.didReceiveMessage == null) {
      throw `${process.processType}[${process.identifier}] won't receive message`
    }

    const dependency = process.getDependentData(SharedMemory)
    if (dependency === null) { // Dependencyがvoidでundefinedが返る場合を除外するため
      throw `${process.processType}[${process.identifier}] no dependent data`
    }

    return process.didReceiveMessage(args, dependency)
  },
}


const createNewProcessId = <D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(): ProcessId<D, I, M, S, P> => {
  return UniqueId.generate() as ProcessId<D, I, M, S, P>
}

const restoreProcesses = (processStates: ProcessState[]): AnyProcess[] => {
  return processStates.flatMap((processState): AnyProcess[] => {
    try {
      const processType = processTypeDecodingMap[processState.t]
      if (processType == null) {
        PrimitiveLogger.programError(`ProcessManager.restoreProcesses failed: no process type of encoded value: ${processState.t}`)
        return []
      }
      const process = ProcessDecoder.decode(processType, processState.i, processState)
      if (process == null) {
        return []
      }
      return [process]

    } catch (error) {
      PrimitiveLogger.programError(`ProcessManager.restoreProcesses failed: ${error}`)
      return []
    }
  })
}

const storeProcesses = (processes: AnyProcess[]): ProcessState[] => {
  return processes.flatMap((process): ProcessState[] => {
    const encodedProcessType = processTypeEncodingMap[process.processType]
    if (encodedProcessType == null) {
      PrimitiveLogger.programError(`ProcessManager.storeProcesses failed: unknown process type: ${process.processType}`)
      return []
    }
    return [{
      ...process.encode(),
      i: process.processId,
      t: encodedProcessType,
    }]
  })
}

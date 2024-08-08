import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { Mutable } from "shared/utility/types"
import { AnyProcess, AnyProcessId, Process, processDefaultIdentifier, ProcessError, ProcessId } from "../../process/process"
import { processTypeDecodingMap, processTypeEncodingMap, ProcessTypes } from "../../process/process_type_map"
import { SystemCall } from "os_v5/system_call"
import { SerializableObject } from "shared/utility/serializable_types"
import { UniqueId } from "../unique_id"
import { SharedMemory } from "./shared_memory"
import { ProcessStore } from "./process_store"
import { ProcessDecoder, ProcessState } from "./process_decoder"
import { ProcessManagerError } from "./process_manager_error"
import { DependencyGraphNode } from "./process_dependency_graph"
import { ProcessExecutionLog } from "./process_execution_log"
import { ProcessManagerNotification, processManagerProcessDidKillNotification, processManagerProcessDidLaunchNotification } from "./process_manager_notification"
import { DriverProcessConstructor } from "os_v5/process/process_constructor"


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
  cpuUsageThreshold: number
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
  if (mutableMemory.cpuUsageThreshold == null) {
    mutableMemory.cpuUsageThreshold = 20
  }

  return mutableMemory
}


let processManagerMemory: ProcessManagerMemory = {} as ProcessManagerMemory
const processStore = new ProcessStore()
const processExecutionLogs: ProcessExecutionLog[] = []


type ProcessManager = {
  addProcess<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P
  getProcess<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null
  getProcessByIdentifier<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: ProcessTypes, identifier: string): P | null
  getProcessRunningState(processId: AnyProcessId): ProcessRunningState
  hasProcess(processType: ProcessTypes, identifier: string): boolean

  suspend(process: AnyProcess): boolean
  resume(process: AnyProcess): boolean
  killProcess(process: AnyProcess): void

  getDependencyFor<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): D | null
  getRuntimeDescription<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): string | null
  listProcesses(): AnyProcess[]
  listProcessRunningStates(): Readonly<ProcessRunningState & { process: AnyProcess }>[]
  getDependingProcessGraphRecursively(processId: AnyProcessId): DependencyGraphNode | null

  /** @throws */
  sendMessage<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P, argumentParser: ArgumentParser): string

  cpuUsageThreshold(): number
  setCpuUsageThreshold(threshold: number): void
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
        const cpuUsage = Game.cpu.getUsed()

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
          if (error instanceof ProcessError) {
            switch (error.error.case) {
            case "not_executable":
              processStore.suspend(process.processId)
              PrimitiveLogger.fatal(`ProcessManager.run(${process}): raised not_executable error. Suspending...`)
              break
            default: {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const _: never = error.error.case
              break
            }
            }
            throw error
          }

          executionLog.errorRaised.add(process.processId)
          if (processExecutionLogs[1]?.errorRaised.has(process.processId) === true) {
            processStore.suspend(process.processId)
            PrimitiveLogger.fatal(`ProcessManager.run(${process}): raised error twice. Suspending...`)
          }
          throw error

        } finally {

          // TODO: runAfterTick() が計測されていない
          const currentCpuUsage = Game.cpu.getUsed()
          const timeTaken = currentCpuUsage - cpuUsage
          if (timeTaken > processManagerMemory.cpuUsageThreshold) {
            PrimitiveLogger.fatal(`ProcessManager.run(${process}): took ${timeTaken.toFixed(1)} cpu to execute at ${Game.time}`)
          }
        }

      }, `ProcessManager.run(${process})`)()
    })

    executionLog.iterateFinished = true
    if (processExecutionLogs.length > 2) {
      processExecutionLogs.splice(2, processExecutionLogs.length - 2)
    }

    processRunAfterTicks.forEach(runAfterTick => runAfterTick())
  },

  // ---- ProcessManager ---- //
  // Process Lifecycle
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
    missingDependencies.forEach(dependency => {
      const constructor = launchableDrivers.get(dependency.processType)
      if (constructor == null || dependency.identifier !== processDefaultIdentifier) {
        throw new ProcessManagerError({
          case: "lack of dependencies",
          missingDependencies: missingDependencies
        })
      }

      this.addProcess((processId: AnyProcessId) => constructor.create(processId))
    })

    if (process.didLaunch != null) {
      process.didLaunch()
    }

    processStore.add(process) // 全ての処理が完了してから追加する： process側で中断する際は didLaunch() で例外を出す
    notificationManagerDelegate({
      eventName: processManagerProcessDidLaunchNotification,
      launchedProcessId: process.processId,
    })

    return process
  },

  getProcess<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
    return processStore.getProcessById(processId)
  },

  getProcessByIdentifier<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: ProcessTypes, identifier: string): P | null {
    return processStore.getProcessByIdentifier(processType, identifier)
  },

  getProcessRunningState(processId: AnyProcessId): ProcessRunningState {
    return {
      isRunning: processStore.isProcessSuspended(processId) !== true,
    }
  },

  hasProcess(processType: ProcessTypes, identifier: string): boolean {
    return processStore.getProcessByIdentifier(processType, identifier) != null
  },


  // Process Control
  suspend(process: AnyProcess): boolean {
    const suspendedProcessIds = processStore.suspend(process.processId)
    if (suspendedProcessIds.includes(process.processId) !== true) {
      return false
    }

    suspendedProcessIds.forEach(suspendedProcessId => {
      notificationManagerDelegate({
        eventName: "pm_process_suspended",
        suspendedProcessId,
      })
    })

    return true
  },

  resume(process: AnyProcess): boolean {
    if (processStore.resume(process.processId) !== true) {
      return false
    }

    notificationManagerDelegate({
      eventName: "pm_process_resumed",
      resumedProcessId: process.processId,
    })

    return true
  },

  killProcess(process: AnyProcess): void {
    if (process.willTerminate != null) {
      process.willTerminate()
    }

    processStore.remove(process)

    notificationManagerDelegate({
      eventName: processManagerProcessDidKillNotification,
      killedProcessId: process.processId,
    })
  },


  // Utility
  getDependencyFor<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): D | null {
    return process.getDependentData(SharedMemory)
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
  sendMessage<D extends Record<string, unknown> | void, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P, argumentParser: ArgumentParser): string {
    if (process.didReceiveMessage == null) {
      throw `${process.processType}[${process.identifier}] doesn't receive message`
    }

    const dependency = process.getDependentData(SharedMemory)
    if (dependency === null) { // Dependencyがvoidでundefinedが返る場合を除外するため
      throw `${process.processType}[${process.identifier}] no dependent data`
    }

    return process.didReceiveMessage(argumentParser, dependency)
  },

  cpuUsageThreshold(): number {
    return processManagerMemory.cpuUsageThreshold
  },

  setCpuUsageThreshold(threshold: number): void {
    if (threshold < 1) {
      return
    }
    processManagerMemory.cpuUsageThreshold = threshold
  },
}


let launchableDrivers = new Map<ProcessTypes, DriverProcessConstructor>()
export const setLaunchableDriverTypes = (drivers: [ProcessTypes, DriverProcessConstructor][]): void => {
  launchableDrivers = new Map(drivers)
}


let notificationManagerDelegate: (notification: ProcessManagerNotification) => void = (): void => {
  console.log("notificationManagerDelegate called before initialized")
}
export const setNotificationManagerDelegate = (delegate: (notification: ProcessManagerNotification) => void): void => {
  notificationManagerDelegate = delegate
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
      if (error instanceof Error) {
        PrimitiveLogger.programError(`ProcessManager.restoreProcesses failed: ${error}\n${error.stack ?? ""}`)
      } else {
        PrimitiveLogger.programError(`ProcessManager.restoreProcesses failed: ${error}`)
      }
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

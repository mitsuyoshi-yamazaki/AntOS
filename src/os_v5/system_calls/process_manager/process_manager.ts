import { SystemCall } from "os_v5/system_call"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { Mutable } from "shared/utility/types"
import { AnyProcess, AnyProcessId, Process, ProcessId, ProcessSpecifier } from "../../process/process"
import { UniqueId } from "../unique_id"
import { SharedMemory } from "./shared_memory"
import { ProcessDecoder, ProcessState } from "./process_decoder"
import { SerializableObject } from "os_v5/utility/types"
import { processTypeDecodingMap, processTypeEncodingMap, ProcessTypes } from "../../process/process_type_map"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { ValuedMapMap } from "shared/utility/valued_collection"
import { ProcessManagerError } from "./process_manager_error"


type ProcessIdentifier = string
type ProcessRunningState = {
  readonly isRunning: boolean
}


type ProcessManagerMemory = {
  processes: ProcessState[] // 順序を崩さないために配列とする
  suspendedProcessIds: string[]
}


const initializeMemory = (memory: ProcessManagerMemory): ProcessManagerMemory => {
  const mutableMemory = memory as Mutable<ProcessManagerMemory>

  if (mutableMemory.processes == null) {
    mutableMemory.processes = []
  }
  if (mutableMemory.suspendedProcessIds == null) {
    mutableMemory.suspendedProcessIds = []
  }

  return mutableMemory
}


class ProcessStore {
  /// IDからProcessを取得
  private readonly processMap = new Map<AnyProcessId, AnyProcess>()

  /// ProcessType, IdentifierからProcessを取得
  private readonly processIdentifierMap = new ValuedMapMap<ProcessTypes, ProcessIdentifier, AnyProcess>()

  /// Process実行順を保存
  private readonly processList: AnyProcess[] = []

  /// 依存関係を保存
  // private readonly dependencyGraph =

  private suspendedProcessIds: AnyProcessId[] = []


  // Public API
  public add<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): void {
    this.processList.push(process)
    this.processMap.set(process.processId, process)
    this.processIdentifierMap.getValueFor(process.processType).set(process.identifier, process)

    // TODO: 他の変数に入力する
  }

  public remove(process: AnyProcess): void {
    const processListIndex = this.processList.indexOf(process)
    if (processListIndex >= 0) {
      this.processList.splice(processListIndex, 1)
    } else {
      this.programError("remove", `Process ${process.processId} not found in the process list`)
    }

    if (this.processMap.has(process.processId) === true) {
      this.processMap.delete(process.processId)
    } else {
      this.programError("remove", `Process ${process.processId} not found in the process ID map`)
    }

    if (this.processIdentifierMap.getValueFor(process.processType).has(process.identifier) === true) {
      this.processIdentifierMap.getValueFor(process.processType).delete(process.identifier)
    } else {
      this.programError("remove", `Process ${process.processId} not found in the process identifier map`)
    }

    const suspendIndex = this.suspendedProcessIds.indexOf(process.processId)
    if (suspendIndex >= 0) {
      this.suspendedProcessIds.splice(suspendIndex, 1)
    }

    // TODO: 依存関係の解決をする
  }

  public suspend(processId: AnyProcessId): boolean {
    if (this.processMap.has(processId) !== true) {
      this.programError("suspend", `Process ${processId} not found in the process ID map`)
      return false
    }
    if (this.suspendedProcessIds.includes(processId) === true) {
      this.programError("suspend", `Process ${processId} is already suspended`)
      return false
    }
    this.suspendedProcessIds.push(processId)
    return true
  }

  public resume(processId: AnyProcessId): boolean {
    const index = this.suspendedProcessIds.indexOf(processId)
    if (index < 0) {
      this.programError("resume", `Process ${processId} is not suspended`)
      return false
    }
    this.suspendedProcessIds.splice(index, 1)
    return true
  }

  public getProcessById<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
    return this.processMap.get(processId) as P | null
  }

  public getProcessByIdentifier<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: ProcessTypes, identifier: I): P | null {
    const process: AnyProcess | undefined = this.processIdentifierMap.getValueFor(processType).get(identifier)
    return process as P
  }

  public isProcessSuspended(processId: AnyProcessId): boolean {
    return this.suspendedProcessIds.includes(processId)
  }

  public checkDependencies(dependentProcesses: ProcessSpecifier[]): { missingDependencies: ProcessSpecifier[] } {
    const missingDependencies: ProcessSpecifier[] = dependentProcesses.filter(dependency => {
      const processMap = this.processIdentifierMap.get(dependency.processType)
      if (processMap == null) {
        return true // 存在しない場合をフィルタするためtrueで返す
      }
      return processMap.has(dependency.identifier) !== true
    })

    return {
      missingDependencies,
    }
  }

  public listProcesses(): AnyProcess[] {
    return [...this.processList]
  }

  public setSuspendedProcessIds(ids: AnyProcessId[]): void {
    this.suspendedProcessIds = [...ids]
  }

  public getSuspendedProcessIds(): AnyProcessId[] {
    return [...this.suspendedProcessIds]
  }

  // Private API
  private programError(label: string, message: string): void {
    PrimitiveLogger.programError(`[ProcessStore.${label}] ${message}`)
  }
}


let processManagerMemory: ProcessManagerMemory = {} as ProcessManagerMemory
const processStore = new ProcessStore()


type ProcessManager = {
  addProcess<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P
  getProcess<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null
  getProcessRunningState(processId: AnyProcessId): ProcessRunningState
  suspend(process: AnyProcess): boolean
  resume(process: AnyProcess): boolean
  killProcess(process: AnyProcess): void
  getRuntimeDescription<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): string | null
  listProcesses(): AnyProcess[]
  listProcessRunningStates(): Readonly<ProcessRunningState & { process: AnyProcess }>[]
}


export const ProcessManager: SystemCall<"ProcessManager", ProcessManagerMemory> & ProcessManager = {
  name: "ProcessManager",
  [Symbol.toStringTag]: "ProcessManager",

  load(memory: ProcessManagerMemory): void {
    processManagerMemory = initializeMemory(memory)

    restoreProcesses(processManagerMemory.processes).forEach(process => {
      processStore.add(process)
    })
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
    const processRunAfterTicks: (() => void)[] = []

    processStore.listProcesses().forEach(<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P) => {
      ErrorMapper.wrapLoop((): void => {
        const runningState = this.getProcessRunningState(process.processId)
        if (runningState.isRunning !== true) {
          return
        }

        const dependency = process.getDependentData(SharedMemory)
        if (dependency === null) { // Dependencyがvoidでundefinedが返る場合を除外するため
          PrimitiveLogger.fatal(`ProcessManager.run failed: no dependent data for: ${process.processType}`)  // FixMe: エラー処理 // 親processが停止していることがある
          return
        }

        const processMemory = process.run(dependency)
        SharedMemory.set(process.processType, process.identifier, processMemory)

        if (process.runAfterTick != null) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          processRunAfterTicks.push((() => process.runAfterTick!(dependency)))
        }

      }, `ProcessManager.run(${process.processType})`)()
    })

    processRunAfterTicks.forEach(runAfterTick => runAfterTick())
  },

  // ProcessManager
  /** @throws */
  addProcess<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P {
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

    // 依存先含めて作成する場合も静的に制約できないため例外を送出するのは変わらない
    // 依存状況は依存先をkillする際に辿らなければならないため、Process単位で接続している必要がある
    // 依存元はProcessではなくデータに依存しているが、そのデータは依存先Processが作っている

    return process
  },

  getProcess<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
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
    processStore.remove(process)
  },

  getRuntimeDescription<D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): string | null {
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
  }
}


const createNewProcessId = <D, I extends string, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(): ProcessId<D, I, M, S, P> => {
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

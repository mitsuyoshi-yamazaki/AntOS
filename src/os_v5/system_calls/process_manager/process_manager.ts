import { SystemCall } from "os_v5/system_call"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { Mutable } from "shared/utility/types"
import { AnyProcess, AnyProcessId, Process, ProcessId, ProcessSpecifier } from "../../process/process"
import { UniqueId } from "../unique_id"
import { SharedMemory } from "./shared_memory"
import { ProcessDecoder, ProcessState } from "./process_decoder"
import { SerializableObject } from "os_v5/utility/types"
import { processTypeDecodingMap, processTypeEncodingMap, ProcessTypes } from "./process_type_map"
import { ErrorMapper } from "error_mapper/ErrorMapper"


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

  /// Process実行順を保存
  private readonly processList: AnyProcess[] = []

  /// 依存関係を保存
  // private readonly dependencyGraph =

  private readonly suspendedProcessIds: AnyProcessId[] = []


  // Public API
  public add<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): void {
    this.processList.push(process)
    this.processMap.set(process.processId, process)

    // TODO: 他の変数に入力する
  }

  public remove(process: AnyProcess): void {
    const index = this.processList.indexOf(process)
    if (index >= 0) {
      this.processList.splice(index, 1)
    } else {
      this.programError("remove", `Process ${process.processId} not found in the process list`)
    }

    if (this.processMap.has(process.processId) === true) {
      this.processMap.delete(process.processId)
    } else {
      this.programError("remove", `Process ${process.processId} not found in the process ID map`)
    }

    // TODO: 依存関係の解決をする
  }

  public suspend(processId: AnyProcessId): void {
    if (this.processMap.has(processId) !== true) {
      this.programError("suspend", `Process ${processId} not found in the process ID map`)
      return
    }
    if (this.suspendedProcessIds.includes(processId) === true) {
      this.programError("suspend", `Process ${processId} is already suspended`)
      return
    }
    this.suspendedProcessIds.push(processId)
  }

  public resume(processId: AnyProcessId): void {
    const index = this.suspendedProcessIds.indexOf(processId)
    if (index < 0) {
      this.programError("resume", `Process ${processId} is not suspended`)
      return
    }
    this.suspendedProcessIds.splice(index, 1)
  }

  public getProcessById<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
    return this.processMap.get(processId) as P | null
  }

  public getProcessByIdentifier<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: string, identifier: I): P | null {
    console.log("getProcessByIdentifier not implemented yet") // FixMe:
    return null // TODO:
  }

  public isProcessSuspended(processId: AnyProcessId): boolean {
    return this.suspendedProcessIds.includes(processId)
  }

  public checkDependencies(dependentProcesses: ProcessSpecifier[]): { missingProcesses: ProcessSpecifier[] } {
    return {
      missingProcesses: [], // TODO:
    }
  }

  public listProcesses(): AnyProcess[] {
    return [...this.processList]
  }

  // Private API
  private programError(label: string, message: string): void {
    PrimitiveLogger.programError(`[ProcessStore.${label}] ${message}`)
  }
}


let processManagerMemory: ProcessManagerMemory = {} as ProcessManagerMemory
const processStore = new ProcessStore()


type ProcessManager = {
  addProcess<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P
  getProcess<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null
  getProcessRunningState(processId: AnyProcessId): ProcessRunningState
  getRuntimeDescription<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): string | null
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
  },

  startOfTick(): void {
    SharedMemory.startOfTick()
  },

  endOfTick(): ProcessManagerMemory {
    processManagerMemory.processes = storeProcesses(processStore.listProcesses())
    return processManagerMemory
  },

  run(): void {
    processStore.listProcesses().forEach(<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P) => {
      ErrorMapper.wrapLoop((): void => {
        const runningState = this.getProcessRunningState(process.processId)
        if (runningState.isRunning !== true) {
          return
        }

        const dependency = process.getDependentData(SharedMemory)
        if (dependency === null) { // Dependencyがvoidでundefinedが返る場合を除外するため
          PrimitiveLogger.fatal(`ProcessManager.run failed: no dependent data for: ${process.constructor.name}`)  // FixMe: エラー処理 // 親processが停止していることがある
          return
        }
        process.run(dependency)
      }, `ProcessManager.run(${process.constructor.name})`)()
    })
  },

  // ProcessManager
  /** @throws */
  addProcess<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P {
    const process = constructor(createNewProcessId())

    // TODO: identifierが一意になっていることの確認

    // TODO: Driver依存チェック
    const { missingProcesses } = processStore.checkDependencies(process.dependencies.processes)
    if (missingProcesses.length > 0) {
      throw `TODO: missing dependencies: ${missingProcesses.map(p => p.processType + "[" + p.processSpecifier + "]")}`
    }

    processStore.add(process)

    // 依存先含めて作成する場合も静的に制約できないため例外を送出するのは変わらない
    // 依存状況は依存先をkillする際に辿らなければならないため、Process単位で接続している必要がある
    // 依存元はProcessではなくデータに依存しているが、そのデータは依存先Processが作っている

    return process
  },

  getProcess<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
    return processStore.getProcessById(processId)
  },

  getProcessRunningState(processId: AnyProcessId): ProcessRunningState {
    return {
      isRunning: processStore.isProcessSuspended(processId) !== true,
    }
  },

  getRuntimeDescription<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): string | null {
    return ErrorMapper.wrapLoop((): string | null => {
      const dependency = process.getDependentData(SharedMemory)
      if (dependency === null) { // Dependencyがvoidでundefinedが返る場合を除外するため
        return null
      }
      return process.runtimeDescription(dependency)

    }, `ProcessManager.getRuntimeDescription(${process.constructor.name})`)()
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


const createNewProcessId = <D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(): ProcessId<D, I, M, S, P> => {
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
  return processes.map(process => {
    const encodedProcessType = processTypeEncodingMap[process.constructor.name as ProcessTypes]
    if (encodedProcessType == null) {
      PrimitiveLogger.programError(`ProcessManager.storeProcesses failed: unknown process type: ${process.constructor.name}`)
      return
    }
    return {
      ...process.encode(),
      i: process.processId,
      t: encodedProcessType,
    }
  })
}

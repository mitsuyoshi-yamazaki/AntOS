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


type ProcessManagerMemory = {
  processes: ProcessState[] // 順序を崩さないために配列とする
}

const initializeMemory = (memory: ProcessManagerMemory): ProcessManagerMemory => {
  const mutableMemory = memory as Mutable<ProcessManagerMemory>

  if (mutableMemory.processes == null) {
    mutableMemory.processes = []
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

  public add<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(process: P): void {
    this.processList.push(process)

    // TODO: 他の変数に入力する
  }

  public getProcessById<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null {
    return null // TODO:
  }

  public getProcessByIdentifier<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processType: string, identifier: I): P | null {
    return null // TODO:
  }

  public checkDependencies(dependentProcesses: ProcessSpecifier[]): { missingProcesses: ProcessSpecifier[] } {
    return {
      missingProcesses: [], // TODO:
    }
  }

  public listProcesses(): AnyProcess[] {
    return [...this.processList]
  }
}


let processManagerMemory: ProcessManagerMemory = {} as ProcessManagerMemory
const processStore = new ProcessStore()


type ProcessManager = {
  addProcess<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P
  getProcess<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(processId: ProcessId<D, I, M, S, P>): P | null
  listProcesses(): AnyProcess[]
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
        const dependency = process.getDependentData(SharedMemory)
        if (dependency === null) { // Dependencyがvoidでundefinedが返る場合を除外するため
          PrimitiveLogger.fatal(`ProcessManager.run failed: no dependent data for: ${process.constructor.name}`)  // FixMe: エラー処理
          return
        }
        process.run(dependency)
      }, `run ${process.constructor.name}`)()
    })
  },

  // ProcessManager
  /** @throws */
  addProcess<D, I, M, S extends SerializableObject, P extends Process<D, I, M, S, P>>(constructor: (processId: ProcessId<D, I, M, S, P>) => P): P {
    const process = constructor(createNewProcessId())

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

  listProcesses(): AnyProcess[] {
    return processStore.listProcesses()
  },
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

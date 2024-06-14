import { SystemCall } from "os_v5/system_call"
import { checkMemoryIntegrity } from "os_v5/utility/types"
import { PrimitiveLogger } from "shared/utility/logger/primitive_logger"
import { Mutable } from "shared/utility/types"
import { AnyProcess, AnyProcessId, Process, ProcessId, ProcessSpecifier, ProcessState } from "../../process/process"
import { UniqueId } from "../unique_id"
import { SharedMemory } from "./shared_memory"
import { ProcessDecoder } from "./process_decoder"

type ProcessManagerMemory = {
  processes: ProcessState[] // 順序を崩さないために配列とする
}

const initializeMemory = (rawMemory: unknown): ProcessManagerMemory => {
  const memory = rawMemory as Mutable<ProcessManagerMemory>

  if (memory.processes == null) {
    memory.processes = []
  }

  return memory
}

class ProcessStore {
  /// IDからProcessを取得
  private readonly processMap = new Map<AnyProcessId, AnyProcess>()

  /// Process実行順を保存
  private readonly processList: AnyProcess[] = []

  /// 依存関係を保存
  // private readonly dependencyGraph =

  public add<D, I, M, P extends Process<D, I, M, P>>(process: P): void {
    this.processList.push(process)

    // TODO: 他の変数に入力する
  }

  public getProcessById<D, I, M, P extends Process<D, I, M, P>>(processId: ProcessId<D, I, M, P>): P | null {
    return null // TODO:
  }

  public getProcessByIdentifier<D, I, M, P extends Process<D, I, M, P>>(processType: string, identifier: I): P | null {
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

let processManagerMemory: ProcessManagerMemory = initializeMemory({})
const processStore = new ProcessStore()


type ProcessManager = {
  addProcess<D, I, M, P extends Process<D, I, M, P>>(constructor: (processId: ProcessId<D, I, M, P>) => P): P
  getProcess<D, I, M, P extends Process<D, I, M, P>>(processId: ProcessId<D, I, M, P>): P | null
  listProcesses(): AnyProcess[]
}

export const ProcessManager: SystemCall & ProcessManager = {
  name: "ProcessManager",

  load(memoryReference: unknown): void {
    checkMemoryIntegrity(processManagerMemory, initializeMemory, "ProcessManager")
    processManagerMemory = initializeMemory(memoryReference)

    restoreProcesses()
  },

  startOfTick(): void {
    SharedMemory.startOfTick()
  },

  endOfTick(): void {
    storeProcesses()
  },

  run(): void {
  },

  // ProcessManager
  /** @throws */
  addProcess<D, I, M, P extends Process<D, I, M, P>>(constructor: (processId: ProcessId<D, I, M, P>) => P): P {
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

  getProcess<D, I, M, P extends Process<D, I, M, P>>(processId: ProcessId<D, I, M, P>): P | null {
    return processStore.getProcessById(processId)
  },

  listProcesses(): AnyProcess[] {
    return processStore.listProcesses()
  },
}

const createNewProcessId = <D, I, M, P extends Process<D, I, M, P>>(): ProcessId<D, I, M, P> => {
  return UniqueId.generate() as ProcessId<D, I, M, P>
}

const restoreProcesses = (): void => {
  processManagerMemory.processes.forEach(processState => {
    try {
      const process = ProcessDecoder.decode(processState)
      if (process == null) {
        return
      }
      processStore.add(process)

    } catch (error) {
      PrimitiveLogger.programError(`ProcessManager.restoreProcesses failed: ${error}`)
    }
  })
}

const storeProcesses = (): void => {
  const processStates: ProcessState[] = processStore.listProcesses().map(process => {
    return process.encode()
  })

  processManagerMemory.processes = processStates
}

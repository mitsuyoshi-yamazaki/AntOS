import { SystemCall } from "os_v5/system_call"
import { State } from "os_v5/utility/codable"
import { checkMemoryIntegrity } from "os_v5/utility/types"
import { Mutable } from "shared/utility/types"
import { AnyProcess, AnyProcessId, Process, ProcessId } from "../../process/process"
import { UniqueId } from "../unique_id"
import { SharedMemory } from "./shared_memory"

type ProcessManagerMemory = {
  readonly processes: {[Id: string]: State}
}

const initializeMemory = (rawMemory: unknown): ProcessManagerMemory => {
  const memory = rawMemory as Mutable<ProcessManagerMemory>

  if (memory.processes == null) {
    memory.processes = {}
  }

  return memory
}

let processManagerMemory: ProcessManagerMemory = initializeMemory({})
const processes = new Map<AnyProcessId, AnyProcess>()

type ProcessManager = {
  addProcess<D, P extends Process<D, P>>(constructor: (processId: ProcessId<D, P>) => P): P
  getProcess<D, P extends Process<D, P>>(processId: ProcessId<D, P>): P | null
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

  // ProcessManager
  addProcess<D, P extends Process<D, P>>(constructor: (processId: ProcessId<D, P>) => P): P {
    const process = constructor(createNewProcessId())
    // TODO: 保存処理
    return process
  },

  getProcess<D, P extends Process<D, P>>(processId: ProcessId<D, P>): P | null {
    return processes.get(processId) as P | null
  },

  listProcesses(): AnyProcess[] {
    return Array.from(processes.values())
  },
}

const createNewProcessId = <D, P extends Process<D, P>>(): ProcessId<D, P> => {
  return UniqueId.generate() as ProcessId<D, P>
}

const restoreProcesses = (): void => {
}

const storeProcesses = (): void => {
}

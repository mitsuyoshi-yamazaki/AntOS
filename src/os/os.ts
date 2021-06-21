import { ErrorMapper } from "../error_mapper/ErrorMapper"
import { isProcedural, isStatefulProcess, Process, ProcessId } from "../process/process"
import { RootProcess } from "./infrastructure/root"
import { ProcessRestorer } from "./process_restorer"

interface ProcessMemory {
  i: number   // processId
  t: string   // processType
  r: boolean  // running
}

interface ProcessStateMemory extends ProcessMemory {
  s: unknown  // state
}

interface ProcessInfo {
  running: boolean
  process: Process
}

export interface OSMemory {
  p: ProcessMemory[]  // processes (stateless)
  ps: ProcessStateMemory[]  // processStates
}

/**
 * - https://zenn.dev/mitsuyoshi/scraps/3917e7502ef385
 * - [ ] RootProcessの依存を外して単体でtestableにする
 * - [ ] Memoryの依存を外す
 */
export class OperatingSystem {
  static readonly os = new OperatingSystem()

  private launchTime = Game.time
  private processIndex = 0
  private readonly rootProcess = new RootProcess()
  private readonly processes = new Map<ProcessId, ProcessInfo>()

  private constructor() {
    ErrorMapper.wrapLoop(() => {  // TODO: try-catchに書き換え
      this.setupMemory()
      this.restoreProcesses()
    }, "OperatingSystem()")()
  }

  // ---- Process ---- //
  public addProcess<T extends Process>(maker: (processId: ProcessId) => T): T {
    const processId = this.getNewProcessId()
    const process = maker(processId)
    const processInfo: ProcessInfo = {
      process,
      running: true,
    }
    this.processes.set(processId, processInfo)
    console.log(`Launch process ${process.constructor.name}, ID: ${processId}`)
    return process
  }

  public processOf(processId: ProcessId): Process | undefined {
    return this.processes.get(processId)?.process
  }

  public suspendProcess(processId: ProcessId): void {
    const processInfo = this.processes.get(processId)
    if (processInfo == null) {
      this.sendOSError(`No process with ID ${processId} (suspendProcess())`)
      return
    }

    processInfo.running = false
    this.processes.set(processId, processInfo)
  }

  public resumeProcess(processId: ProcessId): void {
    const processInfo = this.processes.get(processId)
    if (processInfo == null) {
      this.sendOSError(`No process with ID ${processId} (resumeProcess())`)
      return
    }

    processInfo.running = true
    this.processes.set(processId, processInfo)
  }

  public killProcess(processId: ProcessId): void {
    const process = this.processOf(processId)
    if (process == null) {
      console.log(`[OS Error] Trying to kill unknown process ${processId}`)
      return
    }
    console.log(`Kill process ${process.constructor.name}, ID: ${processId}`)
    this.processes.delete(processId)
  }

  // ---- Run ---- //
  public run(): void {
    ErrorMapper.wrapLoop(() => {  // TODO: try-catchに書き換え
      this.rootProcess.run()
      this.runProceduralProcesses()
      this.storeProcesses()
    }, "OperatingSystem.run()")()
  }

  // ---- Private ---- //
  // ---- Persistent Store ---- //
  private setupMemory(): void {
    if (Memory.os == null) {
      Memory.os = {
        p: [],
        ps: [],
      }
    }
    if (Memory.os.p == null) {
      Memory.os.p = []
    }
    if (Memory.os.ps == null) {
      Memory.os.ps = []
    }
  }

  private restoreProcesses(): void {
    Memory.os.p.forEach(processMemory => {
      const process = ProcessRestorer.createStatelessProcess(processMemory.t, processMemory.i)
      if (process == null) {
        console.log(`[OS Error] Unrecognized process type ${processMemory.t}`)
        return
      }
      const processInfo: ProcessInfo = {
        process,
        running: processMemory.r === true
      }
      this.processes.set(process.processId, processInfo)
    })

    Memory.os.ps.forEach(processStateMemory => {
      const process = ProcessRestorer.createStatefullProcess(processStateMemory.t, processStateMemory.i, processStateMemory.s)
      if (process == null) {
        console.log(`[OS Error] Unrecognized stateful process type ${processStateMemory.t}`)
        return
      }
      const processInfo: ProcessInfo = {
        process,
        running: processStateMemory.r === true
      }
      this.processes.set(process.processId, processInfo)
    })
  }

  private storeProcesses(): void {
    const processesMemory: ProcessMemory[] = []
    const processStatesMemory: ProcessStateMemory[] = []
    Array.from(this.processes.values()).forEach(processInfo => {
      const process = processInfo.process
      if (process.shouldStore === false) {
        return
      }
      try {
        const processType = ProcessRestorer.processTypeOf(process)
        if (processType == null) {
          console.log(`[OS Error] Process type of ${process.constructor.name} not defined in ProcessRestorer`)
          return
        }
        if (isStatefulProcess(process)) {
          processStatesMemory.push({
            i: process.processId,
            t: processType,
            r: processInfo.running,
            s: process.encode(),
          })
        } else {
          processesMemory.push({
            i: process.processId,
            t: processType,
            r: processInfo.running,
          })
        }
      } catch (error) {
        console.log(`[OS Error] Process ${process.constructor.name}.encode() failed with error: ${error}`)
      }
    })
    Memory.os.p = processesMemory
    Memory.os.ps = processStatesMemory
  }

  // ---- Execution ---- //
  private runProceduralProcesses(): void {
    Array.from(this.processes.values()).forEach(processInfo => {
      if (processInfo.running !== true) {
        return
      }
      if (!isProcedural(processInfo.process)) {
        return
      }
      processInfo.process.runOnTick()
    })
  }

  // ---- Utility ---- //
  private getNewProcessId(): ProcessId {
    const processId = Game.time * 1000 + this.processIndex
    this.processIndex += 1
    return processId
  }

  private sendOSError(message: string): void {
    console.log(`[OS Error] ${message}`)
  }
}

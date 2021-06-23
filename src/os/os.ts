import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeProcessFrom, isProcedural, Process, ProcessId, ProcessState } from "task/process"
import { RootProcess } from "./infrastructure/root"

interface ProcessMemory {
  /** running */
  r: boolean

  /** process state */
  s: ProcessState
}

interface InternalProcessInfo {
  running: boolean
  process: Process
}

export interface ProcessInfo {
  processId: number
  type: string
  running: boolean
  process: Process
}

export interface OSMemory {
  p: ProcessMemory[]  // processes (stateless)
}

/**
 * - https://zenn.dev/mitsuyoshi/scraps/3917e7502ef385
 * - [ ] RootProcessの依存を外して単体でtestableにする
 * - [ ] Memoryの依存を外す
 */
export class OperatingSystem {
  static readonly os = new OperatingSystem()

  private processIndex = 0
  private readonly rootProcess = new RootProcess()
  private readonly processes = new Map<ProcessId, InternalProcessInfo>()

  private constructor() {
    ErrorMapper.wrapLoop(() => {
      this.setupMemory()
    }, "OperatingSystem.setupMemory()")()

    ErrorMapper.wrapLoop(() => {
      this.restoreProcesses()
    }, "OperatingSystem.restoreProcesses()")()
  }

  // ---- Process ---- //
  public addProcess<T extends Process>(maker: (processId: ProcessId) => T): T {
    const processId = this.getNewProcessId()
    const process = maker(processId)
    const processInfo: InternalProcessInfo = {
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

  public killProcess(processId: ProcessId): ResultType<string> {
    const process = this.processOf(processId)
    if (process == null) {
      return new ResultFailed(new Error(`[OS Error] Trying to kill unknown process ${processId}`))
    }
    console.log(`Kill process ${process.constructor.name}, ID: ${processId}`) // TODO: 呼び出し元で表示し、消す
    this.processes.delete(processId)
    return new ResultSucceeded(process.constructor.name)
  }

  public processInfoOf(processId: ProcessId): ProcessInfo | null {
    const processInfo = this.processes.get(processId)
    if (processInfo == null) {
      return null
    }
    return {
      processId: processInfo.process.processId,
      type: processInfo.process.constructor.name,
      running: processInfo.running,
      process: processInfo.process,
    }
  }

  public listAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values()).map(processInfo => {
      const info: ProcessInfo = {
        processId: processInfo.process.processId,
        type: processInfo.process.constructor.name,
        running: processInfo.running,
        process: processInfo.process,
      }
      return info
    })
  }

  // ---- Run ---- //
  public run(): void {
    ErrorMapper.wrapLoop(() => {
      this.setupMemory()
    }, "OperatingSystem.setupMemory()")()

    ErrorMapper.wrapLoop(() => {
      this.rootProcess.run()
    }, "OperatingSystem.rootProcess.run()")()

    ErrorMapper.wrapLoop(() => {
      this.runProceduralProcesses()
    }, "OperatingSystem.runProceduralProcesses()")()

    ErrorMapper.wrapLoop(() => {
      this.storeProcesses()
    }, "OperatingSystem.storeProcesses()")()
  }

  // ---- Private ---- //
  // ---- Persistent Store ---- //
  private setupMemory(): void {
    if (Memory.os == null) {
      Memory.os = {
        p: [],
      }
    }
    if (Memory.os.p == null) {
      Memory.os.p = []
    }
  }

  private restoreProcesses(): void {
    Memory.os.p.forEach(processStateMemory => {
      const process = decodeProcessFrom(processStateMemory.s)
      if (process == null) {
        this.sendOSError(`Unrecognized stateful process type ${processStateMemory}`)
        return
      }
      const processInfo: InternalProcessInfo = {
        process,
        running: processStateMemory.r === true
      }
      this.processes.set(process.processId, processInfo)
    })
  }

  private storeProcesses(): void {
    const processesMemory: ProcessMemory[] = []
    Array.from(this.processes.values()).forEach(processInfo => {
      const process = processInfo.process
      ErrorMapper.wrapLoop(() => {
        processesMemory.push({
          r: processInfo.running,
          s: process.encode(),
        })
      }, "OperatingSystem.storeProcesses()")()
    })
    Memory.os.p = processesMemory
  }

  // ---- Execution ---- //
  private runProceduralProcesses(): void {
    Array.from(this.processes.values()).forEach(processInfo => {
      if (processInfo.running !== true) {
        return
      }
      const process = processInfo.process
      if (isProcedural(process)) {
        ErrorMapper.wrapLoop(() => {
          process.runOnTick()
        }, `Procedural process ${process.processId} run()`)()
      }
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

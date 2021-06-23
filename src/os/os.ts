import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"
import { ErrorMapper } from "../error_mapper/ErrorMapper"
import { isProcedural, isStatefulProcess, Process, ProcessId } from "../process/process"
import { RootProcess } from "./infrastructure/root"
import { ProcessRestorer } from "./process_restorer"

interface ProcessMemory {
  l: number   // launchTime
  i: number   // processId
  t: string   // processType
  r: boolean  // running
}

interface ProcessStateMemory extends ProcessMemory {
  s: unknown  // state
}

interface InternalProcessInfo {
  running: boolean
  process: Process
}

export interface ProcessInfo {
  processId: number
  type: string
  running: boolean
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
  private readonly processes = new Map<ProcessId, InternalProcessInfo>()

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

  public listAllProcesses(): ProcessInfo[] {
    return Array.from(this.processes.values()).map(processInfo => {
      const info: ProcessInfo = {
        processId: processInfo.process.processId,
        type: processInfo.process.constructor.name,
        running: processInfo.running,
      }
      return info
    })
  }

  // ---- Run ---- //
  public run(): void {
    ErrorMapper.wrapLoop(() => {
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
      const processInfo: InternalProcessInfo = {
        process,
        running: processMemory.r === true
      }
      this.processes.set(process.processId, processInfo)
    })

    Memory.os.ps.forEach(processStateMemory => {
      const process = ProcessRestorer.createStatefullProcess(processStateMemory.t, processStateMemory.l, processStateMemory.i, processStateMemory.s)
      if (process == null) {
        console.log(`[OS Error] Unrecognized stateful process type ${processStateMemory.t}`)
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
            l: process.launchTime,
            i: process.processId,
            t: processType,
            r: processInfo.running,
            s: process.encode(),
          })
        } else {
          processesMemory.push({
            l: process.launchTime,
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

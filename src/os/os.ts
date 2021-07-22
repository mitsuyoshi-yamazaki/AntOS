import { Result } from "utility/result"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import type { Process, ProcessId } from "process/process"
import { isProcedural } from "process/procedural"
import { RootProcess } from "./infrastructure/root"
import { RuntimeMemory, ProcessLog } from "./infrastructure/runtime_memory"
import { LoggerProcess } from "./process/logger"
import { init as initRoomPositionPrototype } from "prototype/room_position"
import { init as initRoomObjectPrototype } from "prototype/room_object"
import { init as initCreepPrototype } from "prototype/creep"
import { init as initStructureSpawnPrototype } from "prototype/structure_spawn"
import { init as initRoomPrototype } from "prototype/room"
import type { ProcessState } from "process/process_state"
import { decodeProcessFrom } from "process/process_decoder"
import { ProcessInfo } from "./os_process_info"
import type { ProcessLauncher } from "./os_process_launcher"

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

export interface OSMemory {
  p: ProcessMemory[]  // processes (stateless)
}

function init(): void {
  updatePrototypes()
}

function updatePrototypes(): void {
  initRoomPositionPrototype()
  initRoomObjectPrototype()
  initCreepPrototype()
  initStructureSpawnPrototype()
  initRoomPrototype()
}

const processLauncher: ProcessLauncher = (launcher: (processId: ProcessId) => Process) => OperatingSystem.os.addProcess(launcher)

/**
 * - https://zenn.dev/mitsuyoshi/scraps/3917e7502ef385
 * - [ ] RootProcessの依存を外して単体でtestableにする
 * - [ ] Memoryの依存を外す
 */
export class OperatingSystem {
  static readonly os = (() => {
    init()
    return new OperatingSystem()
  })()

  private didSetup = false
  private processIndex = 0
  private readonly rootProcess = new RootProcess()
  private readonly processes = new Map<ProcessId, InternalProcessInfo>()
  private readonly processIdsToKill: ProcessId[] = []
  private runtimeMemory: RuntimeMemory = {processLogs: []}

  private constructor() {
    // !!!! 起動処理がOSアクセスを行う場合があるためsetup()内部で実行すること !!!! //
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

  /**
   * killを予約する。実行されるのはstoreProcesses()の前
   */
  public killProcess(processId: ProcessId): Result<string, string> {
    const process = this.processOf(processId)
    if (process == null) {
      return Result.Failed(`[OS Error] Trying to kill unknown process ${processId}`)
    }
    if (this.processIdsToKill.includes(processId) !== true) {
      this.processIdsToKill.push(processId)
    }
    return Result.Succeeded(process.constructor.name)
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

  // ---- Runtime Memory Access ---- //
  // - [ ] 任意のkeyに対するAPIに書き換える
  public addProcessLog(log: ProcessLog): void {
    this.runtimeMemory.processLogs.push(log)
  }

  public processLogs(): ProcessLog[] {
    return this.runtimeMemory.processLogs.concat([])
  }

  public clearProcessLogs(): void {
    this.runtimeMemory.processLogs.splice(0, this.runtimeMemory.processLogs.length)
  }

  // FixMe: プロセス特定の仕組みを実装する
  public getLoggerProcess(): LoggerProcess | null {
    const processInfo = Array.from(this.processes.values()).find(processInfo => processInfo.process instanceof LoggerProcess)
    if (processInfo == null) {
      return null
    }
    return processInfo.process as LoggerProcess
  }

  // ---- Run ---- //
  private setup(): void {
    ErrorMapper.wrapLoop(() => {
      this.setupMemory()
    }, "OperatingSystem.setupMemory()")()

    ErrorMapper.wrapLoop(() => {
      this.restoreProcesses()
    }, "OperatingSystem.restoreProcesses()")()

    ErrorMapper.wrapLoop(() => {
      this.rootProcess.setup()
    }, "OperatingSystem.rootProcess.setup()")()
  }

  public run(): void {
    if (this.didSetup !== true) {
      this.setup()
      this.didSetup = true
    }

    ErrorMapper.wrapLoop(() => {
      const processList = this.listAllProcesses().map(processInfo => processInfo.process)
      this.rootProcess.runBeforeTick(processList, processLauncher)
    }, "OperatingSystem.rootProcess.runBeforeTick()")()

    ErrorMapper.wrapLoop(() => {
      this.runProceduralProcesses()
    }, "OperatingSystem.runProceduralProcesses()")()

    ErrorMapper.wrapLoop(() => {
      this.killProcesses()
    }, "OperatingSystem.killProcesses()")()

    ErrorMapper.wrapLoop(() => {
      this.storeProcesses()
    }, "OperatingSystem.storeProcesses()")()

    ErrorMapper.wrapLoop(() => {
      this.rootProcess.runAfterTick()
    }, "OperatingSystem.rootProcess.runAfterTick()")()
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
    this.processes.clear()
    Memory.os.p.forEach(processStateMemory => {
      const process = decodeProcessFrom(processStateMemory.s)
      if (process == null) {
        this.sendOSError(`Unrecognized stateful process type ${processStateMemory.s.t}, ${processStateMemory.s.i}`)
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

  // ---- Kill ---- //
  private killProcesses(): void {
    this.processIdsToKill.forEach(processId => {
      const processInfo = this.processes.get(processId)
      if (processInfo == null) {
        this.sendOSError(`[Program bug] Trying to kill non existent process ${processId}`)
        return
      }
      console.log(`Kill process ${processInfo.process.constructor.name}, ID: ${processId}`) // TODO: 呼び出し元で表示し、消す
      this.processes.delete(processId)
    })
    this.processIdsToKill.splice(0, this.processIdsToKill.length)
  }
}

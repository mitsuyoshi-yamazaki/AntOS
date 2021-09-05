import { Result } from "utility/result"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import type { Process, ProcessId } from "process/process"
import { isProcedural } from "process/procedural"
import { RootProcess } from "./infrastructure/root"
import { init as initRoomPositionPrototype } from "prototype/room_position"
import { init as initRoomObjectPrototype } from "prototype/room_object"
import { init as initCreepPrototype } from "prototype/creep"
import { init as initPowerCreepPrototype } from "prototype/power_creep"
import { init as initStructureSpawnPrototype } from "prototype/structure_spawn"
import { init as initRoomPrototype } from "prototype/room"
import type { ProcessState } from "process/process_state"
import { decodeProcessFrom } from "process/process_decoder"
import { ProcessInfo } from "./os_process_info"
import type { ProcessLauncher } from "./os_process_launcher"
import { LoggerMemory } from "./infrastructure/logger"
import { PrimitiveLogger } from "./infrastructure/primitive_logger"

interface ProcessMemory {
  /** running */
  readonly r: boolean

  /** process state */
  readonly s: ProcessState

  readonly childProcessIds: ProcessId[]
}

interface InternalProcessInfo {
  running: boolean
  readonly process: Process
  readonly childProcessIds: ProcessId[]
}

export interface OSMemory {
  p: ProcessMemory[]  // processes (stateless)
  config: {
    /** 毎tickメモリ呼び出しを行う: ProcessStateを手動で編集することが可能になる */
    shouldReadMemory?: boolean
  }
  logger: LoggerMemory
}

function init(): void {
  updatePrototypes()
}

function updatePrototypes(): void {
  initRoomPositionPrototype()
  initRoomObjectPrototype()
  initCreepPrototype()
  initPowerCreepPrototype()
  initStructureSpawnPrototype()
  initRoomPrototype()

  // ErrorMapper.wrapLoop(() => {
  //   initRoomPositionPrototype()
  // })()
  // ErrorMapper.wrapLoop(() => {
  //   initRoomObjectPrototype()
  // })()
  // ErrorMapper.wrapLoop(() => {
  //   initCreepPrototype()
  // })()
  // ErrorMapper.wrapLoop(() => {
  //   initPowerCreepPrototype()
  // })()
  // ErrorMapper.wrapLoop(() => {
  //   initStructureSpawnPrototype()
  // })()
  // ErrorMapper.wrapLoop(() => {
  //   initRoomPrototype()
  // })()
}

const processLauncher: ProcessLauncher = (parentProcessId: ProcessId | null, launcher: (processId: ProcessId) => Process) => OperatingSystem.os.addProcess(parentProcessId, launcher)


class ProcessStore {
  private readonly processes = new Map<ProcessId, InternalProcessInfo>()
  private readonly parentProcessIds = new Map<ProcessId, ProcessId>()

  public get(processId: ProcessId): InternalProcessInfo | null {
    return this.processes.get(processId) ?? null
  }

  public add(process: Process, parentProcessId: ProcessId | null): void {
    if (parentProcessId != null) {
      const parentProcessInfo = this.processes.get(parentProcessId)
      if (parentProcessInfo == null) {
        PrimitiveLogger.programError(`Processes.addProcess() unknown parent process ID ${parentProcessId} for process ${process.processId} ${process.taskIdentifier}`)
      } else {
        parentProcessInfo.childProcessIds.push(process.processId)
      }
    }
    const processInfo: InternalProcessInfo = {
      process,
      running: true,
      childProcessIds: [],
    }
    this.processes.set(process.processId, processInfo)
  }

  public remove(processId: ProcessId): void {
    const processInfo = this.get(processId)
    if (processInfo == null) {
      PrimitiveLogger.programError(`Trying to remove non existent process ${processId}`)
      return
    }
    processInfo.childProcessIds.forEach(childProcessId => {
      this.parentProcessIds.delete(childProcessId)
    })
    this.processes.delete(processId)
  }

  public replace(processes: InternalProcessInfo[]): void {
    this.clear()

    processes.forEach(processInfo => {
      const processId = processInfo.process.processId
      this.processes.set(processId, processInfo)

      processInfo.childProcessIds.forEach(childProcessId => {
        if (this.parentProcessIds.has(childProcessId) === true) {
          PrimitiveLogger.programError(`ProcessStore.replace() found more than 1 parent for ${childProcessId} (${processId}, ${this.parentProcessIds.get(childProcessId)})`)
        }
        this.parentProcessIds.set(childProcessId, processId)
      })
    })
  }

  public clear(): void {
    this.processes.clear()
    this.parentProcessIds.clear()
  }

  public list(): InternalProcessInfo[] {
    return Array.from(this.processes.values())
  }
}

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
  private readonly processStore = new ProcessStore()
  private readonly processIdsToKill: ProcessId[] = []

  private constructor() {
    // !!!! 起動処理がOSアクセスを行う場合があるため、起動時に一度だけ行う処理はsetup()内部で実行すること !!!! //
  }

  // ---- Process ---- //
  public addProcess<T extends Process>(parentProcessId: ProcessId | null, maker: (processId: ProcessId) => T): T {
    const processId = this.getNewProcessId()
    const process = maker(processId)
    this.processStore.add(process, parentProcessId)
    PrimitiveLogger.log(`Launch process ${process.taskIdentifier}, ID: ${processId}`)
    return process
  }

  public processOf(processId: ProcessId): Process | null {
    return this.processStore.get(processId)?.process ?? null
  }

  public suspendProcess(processId: ProcessId): Result<string, string> {
    const processInfo = this.processStore.get(processId)
    if (processInfo == null) {
      return Result.Failed(`No process with ID ${processId}`)
    }
    if (processInfo.running !== true) {
      return Result.Failed(`Process with ID ${processId} already suspended`)
    }

    processInfo.running = false
    return Result.Succeeded(processInfo.process.constructor.name)
  }

  public resumeProcess(processId: ProcessId): Result<string, string> {
    const processInfo = this.processStore.get(processId)
    if (processInfo == null) {
      return Result.Failed(`No process with ID ${processId}`)
    }
    if (processInfo.running === true) {
      return Result.Failed(`Process with ID ${processId} already running`)
    }

    processInfo.running = true
    return Result.Succeeded(processInfo.process.constructor.name)
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

  /** @deprecated */
  public respawned(): void {  // TODO: reboot(quitAll?: boolean) のようなメソッドに変更する
    this.processStore.clear()
  }

  public processInfoOf(processId: ProcessId): ProcessInfo | null {
    const processInfo = this.processStore.get(processId)
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
    return this.processStore.list().map(processInfo => {
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
    } else {
      if (Memory.os.config.shouldReadMemory === true) {
        ErrorMapper.wrapLoop(() => {
          this.restoreProcesses()
        }, "OperatingSystem.restoreProcesses()")()
      }
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
        config: {},
        logger: {
          filteringProcessIds: [],
        }
      }
    }
    if (Memory.os.p == null) {
      Memory.os.p = []
    }
    if (Memory.os.config == null) {
      Memory.os.config = {}
    }
    if (Memory.os.logger == null) {
      Memory.os.logger = {
        filteringProcessIds: [],
      }
    }
  }

  private restoreProcesses(): void {
    const processInfo: InternalProcessInfo[] = Memory.os.p.flatMap(processStateMemory => {
      const process = decodeProcessFrom(processStateMemory.s)
      if (process == null) {
        this.sendOSError(`Unrecognized stateful process type ${processStateMemory.s.t}, ${processStateMemory.s.i}`)
        return []
      }
      return {
        process,
        running: processStateMemory.r === true,
        childProcessIds: processStateMemory.childProcessIds ?? [],
      }
    })

    this.processStore.replace(processInfo)
  }

  private storeProcesses(): void {
    const processesMemory: ProcessMemory[] = []
    this.processStore.list().forEach(processInfo => {
      const process = processInfo.process
      ErrorMapper.wrapLoop(() => {
        processesMemory.push({
          r: processInfo.running,
          s: process.encode(),
          childProcessIds: processInfo.childProcessIds,
        })
      }, "OperatingSystem.storeProcesses()")()
    })
    Memory.os.p = processesMemory
  }

  // ---- Execution ---- //
  private runProceduralProcesses(): void {
    this.processStore.list().forEach(processInfo => {
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
    PrimitiveLogger.fatal(`[OS Error] ${message}`)
  }

  // ---- Kill ---- //
  private killProcesses(): void {
    const messages: string[] = []

    const spaces = "                                                  " // 50 spaces
    const getIndent = (indent: number): string => spaces.slice(0, indent * 2)
    const kill = (processId: ProcessId, indent: number): void => {
      const processInfo = this.processStore.get(processId)
      if (processInfo == null) {
        this.sendOSError(`Trying to kill non existent process ${processId}`)
        return
      }

      messages.push(`${getIndent(indent)}- ${processId}: ${processInfo.process.taskIdentifier}`)
      this.processStore.remove(processId)

      const loggerIndex = Memory.os.logger.filteringProcessIds.indexOf(processId)
      if (loggerIndex >= 0) {
        Memory.os.logger.filteringProcessIds.splice(loggerIndex, 1)
      }

      processInfo.childProcessIds.forEach(childProcessId => kill(childProcessId, indent + 1))
    }

    this.processIdsToKill.forEach(processId => {
      kill(processId, 0)
    })
    this.processIdsToKill.splice(0, this.processIdsToKill.length)

    if (messages.length > 0) {
      PrimitiveLogger.log(`Kill process\n${messages.join("\n")}`)
    }
  }
}

import { Result } from "shared/utility/result"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { ProcessMemory } from "./os_memory"
import type { Process, ProcessId } from "process/process"
import { RootProcess } from "./infrastructure/root"
import { init as initRoomPositionPrototype } from "prototype/room_position"
import { init as initRoomObjectPrototype } from "prototype/room_object"
import { init as initCreepPrototype } from "prototype/creep"
import { init as initPowerCreepPrototype } from "prototype/power_creep"
import { init as initStructureSpawnPrototype } from "prototype/structure_spawn"
import { init as initRoomPrototype } from "prototype/room"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessInfo } from "./os_process_info"
import type { ProcessLauncher } from "./os_process_launcher"
import { PrimitiveLogger } from "./infrastructure/primitive_logger"
import { SystemCalls } from "./system_calls"

interface InternalProcessInfo {
  running: boolean
  readonly process: Process
  readonly childProcessIds: ProcessId[]

  /** 最上位（親なし）が0 */
  readonly executionPriority: number
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
}

const processLauncher: ProcessLauncher = (parentProcessId: ProcessId | null, launcher: (processId: ProcessId) => Process) => OperatingSystem.os.addProcess(parentProcessId, launcher)


class ProcessStore {
  private readonly processes = new Map<ProcessId, InternalProcessInfo>()
  private readonly parentProcessIds = new Map<ProcessId, ProcessId>()

  public get(processId: ProcessId): InternalProcessInfo | null {
    return this.processes.get(processId) ?? null
  }

  public add(process: Process, parentProcessId: ProcessId | null): void {
    let executionPriority = 0
    if (parentProcessId != null) {
      const parentProcessInfo = this.processes.get(parentProcessId)
      if (parentProcessInfo == null) {
        PrimitiveLogger.programError(`Processes.addProcess() unknown parent process ID ${parentProcessId} for process ${process.processId} ${process.taskIdentifier}`)
      } else {
        parentProcessInfo.childProcessIds.push(process.processId)
        this.parentProcessIds.set(process.processId, parentProcessId)
        executionPriority = parentProcessInfo.executionPriority + 1
      }
    }
    const processInfo: InternalProcessInfo = {
      process,
      running: true,
      childProcessIds: [],
      executionPriority,
    }
    this.processes.set(process.processId, processInfo)
  }

  public remove(processId: ProcessId): {parentProcessId: ProcessId | null} | null {
    const processInfo = this.get(processId)
    if (processInfo == null) {
      PrimitiveLogger.programError(`Trying to remove non existent process ${processId}`)
      return null
    }
    const parentProcessId = this.parentProcessIds.get(processId) ?? null
    processInfo.childProcessIds.forEach(childProcessId => {
      this.parentProcessIds.delete(childProcessId)
    })
    this.processes.delete(processId)

    return {
      parentProcessId,
    }
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

  public isRunning(processId: ProcessId): boolean {
    const processInfo = this.processes.get(processId)
    if (processInfo == null) {
      PrimitiveLogger.programError(`Processes.isRunning() unknown process ID ${processId}`)
      return false
    }
    if (processInfo.running !== true) {
      return false
    }
    const parentId = this.parentProcessIds.get(processId)
    if (parentId == null) {
      return true
    }
    return this.isRunning(parentId)
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
    const os = new OperatingSystem()
    SystemCalls.load({
      addProcess: <T extends Process>(parentProcessId: ProcessId | null, maker: (processId: ProcessId) => T): T => os.addProcess(parentProcessId, maker),
      listAllProcesses: (): ProcessInfo[] => os.listAllProcesses(),
      suspendProcess: processId => os.suspendProcess(processId),
      resumeProcess: processId => os.resumeProcess(processId),
      killProcess: processId => os.killProcess(processId),
      processOf: processId => os.processOf(processId),
      isRunning: processId => os.isRunning(processId),
    })
    return os
  })()

  private didSetup = false
  private processIndex = 0
  private readonly rootProcess = new RootProcess()
  private readonly processStore = new ProcessStore()
  private readonly processIdsToKill: ProcessId[] = []
  private processIdsToSuspend: ProcessId[] = []

  private constructor() {
    // !!!! 起動処理がOSアクセスを行う場合があるため、起動時に一度だけ行う処理はsetup()内部で実行すること !!!! //
  }

  // ---- Process ---- //
  /** @deprecated use SystemCalls.systemCall?.addProces() */
  public addProcess<T extends Process>(parentProcessId: ProcessId | null, maker: (processId: ProcessId) => T): T {
    const processId = this.getNewProcessId()
    const process = maker(processId)
    this.processStore.add(process, parentProcessId)
    PrimitiveLogger.log(`Launch process ${process.taskIdentifier}, ID: ${processId}`)

    // Game.serialization.shouldSerializeMemory()  // 手動行った場合は次tickにサーバーリセットがかかるとなかったことになってしまうが、一旦許容

    return process
  }

  public processOf(processId: ProcessId): Process | null {
    return this.processStore.get(processId)?.process ?? null
  }

  /**
   * suspendを予約する。実行されるのはstoreProcesses()の前
   * OSの起動中などに予約したい場合に用いる
   */
  public queueProcessSuspend(processId: ProcessId): void {
    if (this.processIdsToSuspend.includes(processId) === true) {
      return
    }
    this.processIdsToSuspend.push(processId)
  }

  public isRunning(processId: ProcessId): boolean {
    const processInfo = this.processStore.get(processId)
    return processInfo?.running ?? false
  }

  /** @deprecated use SystemCalls.systemCall?.suspendProcess() */
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

    // Game.serialization.shouldSerializeMemory()  // 手動行った場合は次tickにサーバーリセットがかかるとなかったことになってしまうが、一旦許容

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

  /** @deprecated use SystemCalls.systemCall?.listAllProcesses() */
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
      if (Memory.os.config.shouldReadMemory === true) { // 手動等でメモリ内容が編集された場合
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
      this.suspendQueuedProcesses()
    }, "OperatingSystem.suspendQueuedProcesses()")()

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
        },
        enabledDrivers: {
          swcAllyRequest: false
        },
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
    if (Memory.os.enabledDrivers == null) {
      Memory.os.enabledDrivers = {
        swcAllyRequest: false,
      }
    }
  }

  private restoreProcesses(): void {
    const processInfo: InternalProcessInfo[] = Memory.os.p.flatMap(processStateMemory => {
      const info = ErrorMapper.wrapLoop((): InternalProcessInfo | null => {
        const process = ProcessDecoder.decode(processStateMemory.s)
        if (process == null) {
          this.sendOSError(`Unrecognized stateful process type ${processStateMemory.s.t}, ${processStateMemory.s.i}`)
          return null
        }
        return {
          process,
          running: processStateMemory.r === true,
          childProcessIds: processStateMemory.childProcessIds ?? [],
          executionPriority: processStateMemory.executionPriority ?? 0,
        }
      }, "ProcessDecoder.decode()")()
      return info || []
    })

    this.processStore.replace(processInfo)
  }

  private storeProcesses(): void {
    // if (Game.serialization.canSkip() === true) {
    //   return
    // }

    const processesMemory: ProcessMemory[] = []
    this.processStore.list().forEach(processInfo => {
      const process = processInfo.process
      ErrorMapper.wrapLoop(() => {
        processesMemory.push({
          r: processInfo.running,
          s: process.encode(),
          childProcessIds: processInfo.childProcessIds,
          executionPriority: processInfo.executionPriority,
        })
      }, "OperatingSystem.storeProcesses()")()
    })
    Memory.os.p = processesMemory
  }

  // ---- Execution ---- //
  private runProceduralProcesses(): void {
    const runningProcessInfo = this.processStore.list()
      .filter(processInfo => this.processStore.isRunning(processInfo.process.processId) === true)
      .sort((lhs, rhs) => {
        return rhs.executionPriority - lhs.executionPriority
      })

    runningProcessInfo.forEach(processInfo => {
      ErrorMapper.wrapLoop((): void => {
        if (processInfo.process.runBeforeTick == null) {
          return
        }
        processInfo.process.runBeforeTick()
      }, `Procedural process ${processInfo.process.processId} runBeforeTick()`)()
    })

    try {
      // const cpuUses: {name: string, cpu: number}[] = []

      // 強制終了処理
      // let lastProcess: InternalProcessInfo | null = null
      runningProcessInfo.forEach(processInfo => {
        // if (Game.cpu.getUsed() > 90) {
        //   throw `cpu: ${Game.cpu.getUsed()}, last process: ${lastProcess?.process.constructor.name} ${lastProcess?.process.processId}`
        // }
        // lastProcess = processInfo
        const process = processInfo.process
        ErrorMapper.wrapLoop((): void => {
          // const before = Game.cpu.getUsed()
          process.runOnTick()
          // const cpuUse = Game.cpu.getUsed() - before
          // if (cpuUse > 10) {
          //   cpuUses.push({
          //     name: `${process.taskIdentifier} - ${process.processShortDescription != null ? process.processShortDescription() : "no desc"}`,
          //     cpu: cpuUse,
          //   })
          // }
        }, `Procedural process ${process.processId} run()`)()
      })

      // if (cpuUses.length > 0) {
      //   cpuUses.sort((lhs, rhs) => rhs.cpu - lhs.cpu)
      //   const logCount = 20
      //   if (cpuUses.length > logCount) {
      //     cpuUses.splice(logCount, cpuUses.length - logCount)
      //   }
      //   console.log(`[Process] large CPU use in ${Game.time}:\n${cpuUses.map(use => `- ${Math.floor(use.cpu * 100) / 100}, ${use.name}`).join("\n")}`)
      // }

    } catch (error) {
      PrimitiveLogger.log(`${error}`)
    }
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

  private suspendQueuedProcesses(): void {
    const messages: string[] = []

    this.processIdsToSuspend.forEach(processId => {
      const result = this.suspendProcess(processId)
      switch (result.resultType) {
      case "succeeded":
        messages.push(result.value)
        break
      case "failed":
        messages.push(result.reason)
        break
      }
    })

    this.processIdsToSuspend = []

    if (messages.length > 0) {
      PrimitiveLogger.log(`Suspend process\n${messages.join("\n")}`)
    }
  }

  // ---- Kill ---- //
  private killProcesses(): void {
    if (this.processIdsToKill.length <= 0) {
      return
    }

    const messages: string[] = []

    const spaces = "                                                  " // 50 spaces
    const getIndent = (indent: number): string => spaces.slice(0, indent * 2)
    const kill = (processId: ProcessId, indent: number): void => {
      const processInfo = this.processStore.get(processId)
      if (processInfo == null) {
        this.sendOSError(`Trying to kill non existent process ${processId}`)
        return
      }
      if (processInfo.process.deinit != null) {
        processInfo.process.deinit()
      }

      const result = this.processStore.remove(processId)
      if (result == null) {
        return
      }
      const additionalInfo: string[] = []
      const { parentProcessId } = result
      if (parentProcessId != null) {
        const parentProcessInfo = this.processStore.get(parentProcessId)
        if (parentProcessInfo == null) {
          this.sendOSError(`Missing parent process ${parentProcessId}, child: ${processId}, ${processInfo.process.taskIdentifier}`)
        } else {
          const index = parentProcessInfo.childProcessIds.indexOf(processId)
          if (index < 0) {
            this.sendOSError(`Missing child process ${processId}, ${processInfo.process.taskIdentifier}, parent: ${parentProcessId}, ${parentProcessInfo.process.taskIdentifier}`)
          } else {
            parentProcessInfo.childProcessIds.splice(index, 1)
            additionalInfo.push(`removed from parent ${parentProcessId}`)
          }
        }
      }

      messages.push(`${getIndent(indent)}- ${processId}: ${processInfo.process.taskIdentifier} ${additionalInfo.join(",")}`)

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

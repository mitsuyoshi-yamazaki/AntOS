import { ErrorMapper } from "../error_mapper/ErrorMapper"
import { isProcedural, isStatefulProcess, Procedural, Process, ProcessId } from "../process/process"
import { RootProcess } from "../process/infrastructure/root"
import { ProcessRestorer } from "./process_restorer"

interface ProcessMemory {
  i: number   // processId
  t: string   // processType
}

interface ProcessStateMemory {
  i: number   // processId
  t: string   // processType
  s: unknown  // state
}

export interface OSMemory {
  p: ProcessMemory[]  // processes (stateless)
  ps: ProcessStateMemory[]  // processStates
}

/**
 * - https://zenn.dev/mitsuyoshi/scraps/3917e7502ef385
 * - tickで途切れるインスタンスのライフサイクルがあたかも途切れていないかのように実装できるようにする
 *   - 状態の永続化
 *     - [ ] Processは永続化したい情報をOSへ渡す
 * - CPU, メモリの使用状況に応じてプロセスの実行密度を変更する
 * - イベントの検出と通知
 *   - 子プロセスには一部のGame APIの呼び出しを制限する
 * - プロセスの親子関係
 *   - 親の情報をstoreすれば良いようにする
 * - RootProcessを含むInfrastructure Processesは状態をもたない
 */
export class OperatingSystem {
  static readonly os = new OperatingSystem()

  private processIndex = 0
  private readonly processes = new Map<ProcessId, Process>()
  private rootProcess = new RootProcess()

  private constructor() {
    ErrorMapper.wrapLoop(() => {  // TODO: try-catchに書き換え
      this.setupMemory()
      this.processes.set(this.rootProcess.processId, this.rootProcess)
      this.rootProcess.infrastructureProcesses().map(process => this.processes.set(process.processId, process))
      this.restoreProcesses()
    }, "OperatingSystem()")()
  }

  // ---- Process ---- //
  public createChildProcess<T extends Process>(parent: Process, maker: (processId: ProcessId) => T): T {
    const processId = this.getNewProcessId()
    const process = maker(processId)
    this.processes.set(processId, process)
    return process
  }

  public addProcess<T extends Process>(maker: (processId: ProcessId) => T): T {
    const processId = this.getNewProcessId()
    const process = maker(processId)
    this.processes.set(processId, process)
    return process
  }

  public processOf(processId: ProcessId): Process | undefined {
    return this.processes.get(processId)
  }

  public suspendProcess(processId: ProcessId): void {
    // TODO:
  }

  public resumeProcess(processId: ProcessId): void {
    // TODO:
  }

  public killProcess(processId: ProcessId): void {
    // TODO:
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
      this.processes.set(process.processId, process)
    })

    Memory.os.ps.forEach(processStateMemory => {
      const process = ProcessRestorer.createStatefullProcess(processStateMemory.t, processStateMemory.i, processStateMemory.s)
      if (process == null) {
        console.log(`[OS Error] Unrecognized process type ${processStateMemory.t}`)
        return
      }
      this.processes.set(process.processId, process)
    })
  }

  private storeProcesses(): void {
    const processesMemory: ProcessMemory[] = []
    const processStatesMemory: ProcessStateMemory[] = []
    Array.from(this.processes.values()).forEach(process => {
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
            s: process.encode(),
          })
        } else {
          processesMemory.push({
            i: process.processId,
            t: processType,
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
    const proceduralProcesses = Array.from(this.processes.values()).filter(process => isProcedural(process)) as unknown as Procedural[]
    proceduralProcesses.forEach(process => process.runOnTick())
  }

  // ---- Utility ---- //
  private getNewProcessId(): ProcessId {
    const processId = Game.time * 1000 + this.processIndex
    this.processIndex += 1
    return processId
  }
}

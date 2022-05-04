import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { UniqueId } from "utility/unique_id"
import { ValuedArrayMap } from "utility/valued_collection"
import { AnyProcess } from "v8/process/any_process"
import { isLaunchMessageObserver } from "v8/process/message_observer/launch_message_observer"
import { ProcessType, ProcessTypeConverter } from "v8/process/process_type"
import { ProcessState, ProcessId } from "../process/process"
import { ProcessDecoder } from "../process/process_decoder"
import { RootProcess } from "../process/root_process"

type ParentProcessId = ProcessId

type ProcessInfo = {
  readonly process: AnyProcess
  readonly running: boolean
}

type ProcessInfoState = {
  readonly s: ProcessState

  /// running
  readonly r: boolean
}

export type ProcessSchedulerMemory = {
  processIdIndex: number
  processInfo: { [P: ParentProcessId]: ProcessInfoState }
}

/**
 * process schedularは使えるCPU時間をprocessに通知し、超過した場合の処理を行い、逆にprocessから通知された優先順位に基づいてprocess実行順を入れ替えたりするものになる
 */
export class ProcessScheduler {
  private readonly rootProcess = new RootProcess()
  private readonly processInfoByProcessId = (new Map<ProcessId, ProcessInfo>())
  private readonly processInfoByParentProcessId = (new ValuedArrayMap<ParentProcessId, ProcessInfo>())
  private processIdIndex: number

  public constructor(
    memory: ProcessSchedulerMemory,
  ) {
    this.processIdIndex = memory.processIdIndex
    this.processInfoByProcessId.set(this.rootProcess.processId, {
      process: this.rootProcess,
      running: true,
    })
    this.decodeProcesses(memory)
  }

  private decodeProcesses(memory: ProcessSchedulerMemory): void {
    Array.from(Object.entries(memory.processInfo)).forEach(([parentProcessId, processInfoMemory]) => {
      const processInfo = this.decodeProcess(processInfoMemory)
      if (processInfo == null) {
        PrimitiveLogger.programError(`ProcessScheduler unable to decode process ${processInfoMemory.s.i} ${processInfoMemory.s.t} (${ProcessTypeConverter.revert(processInfoMemory.s.t)})`)
        return
      }
      this.processInfoByParentProcessId.getValueFor(parentProcessId).push(processInfo)
      this.processInfoByProcessId.set(processInfo.process.processId, processInfo)
    })
  }

  private decodeProcess(state: ProcessInfoState): ProcessInfo | null {
    const process = ProcessDecoder.decode(state.s)
    if (process == null) {
      return null
    }
    return {
      running: state.r,
      process,
    }
  }

  public run(lastCpuUse: number | null): void {
    // TODO: CPU time management
    // TODO: handle child process result

    this.rootProcess.run()
    this.runProcess(this.rootProcess.processId)
  }

  private runProcess(parentProcessId: ProcessId): void {
    const childProcesses = this.processInfoByParentProcessId.get(parentProcessId)
    if (childProcesses == null) {
      return
    }

    childProcesses.forEach(processInfo => {
      if (processInfo.running !== true) {
        return
      }
      processInfo.process.run()

      this.runProcess(processInfo.process.processId)
    })
  }

  // TODO: enableLog
  public launch(parentProcessId: ParentProcessId, maker: (processId: ProcessId) => AnyProcess, options?: {enableLog?: boolean}): AnyProcess {
    const processId = this.createProcessId()
    const process = maker(processId)
    const processInfo: ProcessInfo = {
      process,
      running: true,
    }

    this.processInfoByParentProcessId.getValueFor(parentProcessId).push(processInfo)
    this.processInfoByProcessId.set(processInfo.process.processId, processInfo)

    return process
  }

  private createProcessId(): ProcessId {
    const index = this.processIdIndex
    this.processIdIndex += 1

    return UniqueId.generateFromInteger(index)
  }

  /** @throws */
  public launchWithArguments(parentProcessId: ParentProcessId, processType: ProcessType, args: ArgumentParser): AnyProcess {
    const parentProcess = this.processInfoByProcessId.get(parentProcessId)?.process
    if (parentProcess == null) {
      throw `no parent process with ID ${parentProcessId}`
    }

    if (!isLaunchMessageObserver(parentProcess)) {
      throw `${parentProcess.constructor.name} doesn't have child process`
    }

    const processMaker = parentProcess.didReceiveLaunchMessage(processType)
    const process = this.launch(parentProcessId, processMaker)

    return process
  }
}

import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory, processDefaultIdentifier, ProcessDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { V3BridgeDriverProcessApi } from "./v3_bridge_driver_process"
import { Timestamp } from "shared/utility/timestamp"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

type Dependency = V3BridgeDriverProcessApi

// TODO:
// type FinishConditionDismantle = {
//   readonly case: "dismantle"
//   readonly targetId: Id<Structure<BuildableStructureConstant>>
// }
// type FinishConditionUnclaimed = {
//   readonly case: "unclaimed"
// }
// type FinishCondition = FinishConditionDismantle | FinishConditionUnclaimed

type V3ProcessLauncherProcessState = {
  readonly n: string      /// Name
  readonly m: string      /// V3 message
  readonly in: Timestamp  /// Interval
  readonly r: Timestamp   /// Next run
  readonly u: Timestamp   /// Until
}

ProcessDecoder.register("V3ProcessLauncherProcess", (processId: V3ProcessLauncherProcessId, state: V3ProcessLauncherProcessState) => V3ProcessLauncherProcess.decode(processId, state))

export type V3ProcessLauncherProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, void, V3ProcessLauncherProcessState, V3ProcessLauncherProcess>


export class V3ProcessLauncherProcess extends Process<Dependency, ProcessDefaultIdentifier, void, V3ProcessLauncherProcessState, V3ProcessLauncherProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeDriverProcess", identifier: processDefaultIdentifier},
    ],
  }

  private constructor(
    public readonly processId: V3ProcessLauncherProcessId,
    private readonly name: string,
    private readonly v3Message: string,
    private readonly interval: Timestamp,
    private nextRun: Timestamp,
    private readonly until: Timestamp,
  ) {
    super()
  }

  public encode(): V3ProcessLauncherProcessState {
    return {
      n: this.name,
      m: this.v3Message,
      in: this.interval,
      r: this.nextRun,
      u: this.until,
    }
  }

  public static decode(processId: V3ProcessLauncherProcessId, state: V3ProcessLauncherProcessState): V3ProcessLauncherProcess {
    return new V3ProcessLauncherProcess(processId, state.n, state.m, state.in, state.r, state.u)
  }

  public static create(processId: V3ProcessLauncherProcessId, name: string, v3Message: string, interval: Timestamp, duration: Timestamp): V3ProcessLauncherProcess {
    return new V3ProcessLauncherProcess(processId, name, v3Message, interval, Game.time, Game.time + duration)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
      this.name,
      `next run in: ${this.nextRun - Game.time}`,
      `in ${ConsoleUtility.shortenedNumber(this.until - Game.time)}`,
    ]

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: Dependency): void {
    if (Game.time >= this.until) {
      SystemCalls.processManager.suspend(this)
      return
    }

    if (Game.time < this.nextRun) {
      return
    }

    this.nextRun = Game.time + this.interval

    const result = dependency.sendMessageToV3(this.v3Message)
    SystemCalls.logger.log(this, `\nMessage: '${this.v3Message}'\n${result}`)
  }
}

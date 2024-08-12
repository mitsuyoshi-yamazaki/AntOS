import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory, BotSpecifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { BotApi } from "os_v5/processes/bot/types"
import { BotTypes } from "os_v5/process/process_type_map"


// 「余った資源を処分する」という問題の具体Process


type Dependency = BotApi

type SellExcessResourceProcessState = {
  readonly id: string   /// Process identifier
  readonly b: BotTypes  /// Bot process type
  readonly bi: string   /// Bot process identifier
  readonly r: {[R in ResourceConstant]?: number}
}

ProcessDecoder.register("SellExcessResourceProcess", (processId: SellExcessResourceProcessId, state: SellExcessResourceProcessState) => SellExcessResourceProcess.decode(processId, state))

export type SellExcessResourceProcessId = ProcessId<Dependency, string, void, SellExcessResourceProcessState, SellExcessResourceProcess>


export class SellExcessResourceProcess extends Process<Dependency, string, void, SellExcessResourceProcessState, SellExcessResourceProcess> {
  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  private constructor(
    public readonly processId: SellExcessResourceProcessId,
    public readonly identifier: string,
    private readonly botSpecifier: BotSpecifier,
    private readonly resourceTypesToSell: { [R in ResourceConstant]?: number },
  ) {
    super()

    this.dependencies.processes.push(botSpecifier)
  }

  public encode(): SellExcessResourceProcessState {
    return {
      id: this.identifier,
      b: this.botSpecifier.processType,
      bi: this.botSpecifier.identifier,
      r: this.resourceTypesToSell,
    }
  }

  public static decode(processId: SellExcessResourceProcessId, state: SellExcessResourceProcessState): SellExcessResourceProcess {
    const botSpecifier: BotSpecifier = {
      processType: state.b,
      identifier: state.bi,
    }
    return new SellExcessResourceProcess(processId, state.id, botSpecifier, state.r)
  }

  public static create(processId: SellExcessResourceProcessId, identifier: string, botSpecifier: BotSpecifier): SellExcessResourceProcess {
    return new SellExcessResourceProcess(processId, identifier, botSpecifier, {})
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
    ]

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): void {
  }
}

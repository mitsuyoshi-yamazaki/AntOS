import { ProcessDependencies, ProcessId } from "../../process/process"
import { ApplicationProcess } from "../../process/application_process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { SemanticVersion } from "shared/utility/semantic_version"

type MitsuyoshiBotProcessState = {
  readonly v: string
}

ProcessDecoder.register("MitsuyoshiBotProcess", (processId: MitsuyoshiBotProcessId, state: MitsuyoshiBotProcessState) => MitsuyoshiBotProcess.decode(processId, state))

export type MitsuyoshiBotProcessId = ProcessId<void, "MitsuyoshiBot", MitsuyoshiBotProcessApi, MitsuyoshiBotProcessState, MitsuyoshiBotProcess>

export type MitsuyoshiBotProcessApi = {
  readonly name: string
  readonly version: SemanticVersion
}


export class MitsuyoshiBotProcess extends ApplicationProcess<void, "MitsuyoshiBot", MitsuyoshiBotProcessApi, MitsuyoshiBotProcessState, MitsuyoshiBotProcess> {
  public readonly identifier = "MitsuyoshiBot"
  public readonly applicationName: string
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  public readonly version = new SemanticVersion(10, 0, 0)

  private constructor(
    public readonly processId: MitsuyoshiBotProcessId,
    public readonly previousVersion: string,
  ) {
    super()
    this.applicationName = this.identifier
  }

  public encode(): MitsuyoshiBotProcessState {
    return {
      v: this.version.toString(),
    }
  }

  public static decode(processId: MitsuyoshiBotProcessId, state: MitsuyoshiBotProcessState): MitsuyoshiBotProcess {
    return new MitsuyoshiBotProcess(processId, state.v)
  }

  public static create(processId: MitsuyoshiBotProcessId): MitsuyoshiBotProcess {
    return new MitsuyoshiBotProcess(processId, (new SemanticVersion(10, 0, 0)).toString())
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return `${this.version}`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(): string {
    return "OK"
  }

  public run(): MitsuyoshiBotProcessApi {
    return {
      name: this.applicationName,
      version: this.version,
    }
  }
}

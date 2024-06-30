import { processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ApplicationProcess } from "os_v5/process/application_process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { SemanticVersion } from "shared/utility/semantic_version"


type RoomTaskTrashUnnecessaryResources = {
  readonly case: "trash_unnecessary_resources"
}
type RoomTask = RoomTaskTrashUnnecessaryResources


type V3ResourceDistributorProcessState = {
  readonly r: { [RoomName: string]: RoomTask[] }
}

ProcessDecoder.register("V3ResourceDistributorProcess", (processId: V3ResourceDistributorProcessId, state: V3ResourceDistributorProcessState) => V3ResourceDistributorProcess.decode(processId, state))

export type V3ResourceDistributorProcessId = ProcessId<void, ProcessDefaultIdentifier, void, V3ResourceDistributorProcessState, V3ResourceDistributorProcess>


export class V3ResourceDistributorProcess extends ApplicationProcess<void, ProcessDefaultIdentifier, void, V3ResourceDistributorProcessState, V3ResourceDistributorProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }
  public readonly applicationName = "v3 ResourceDistributor"
  public readonly version = new SemanticVersion(1, 0, 1)


  private constructor(
    public readonly processId: V3ResourceDistributorProcessId,
    public readonly roomTasks: { [RoomName: string]: RoomTask[] },
  ) {
    super()
  }

  public encode(): V3ResourceDistributorProcessState {
    return {
      r: this.roomTasks,
    }
  }

  public static decode(processId: V3ResourceDistributorProcessId, state: V3ResourceDistributorProcessState): V3ResourceDistributorProcess {
    return new V3ResourceDistributorProcess(processId, state.r)
  }

  public static create(processId: V3ResourceDistributorProcessId): V3ResourceDistributorProcess {
    return new V3ResourceDistributorProcess(processId, {})
  }

  public getDependentData(): void {}

  public staticDescription(): string {
    return `managing ${Array.from(Object.keys(this.roomTasks)).length} rooms`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return "OK"
  }

  public run(): void {

  }
}

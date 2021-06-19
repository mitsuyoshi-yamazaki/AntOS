import {
  Process,
  ProcessId,
  PriorityInformation,
  ProcessState,
} from "../../os/process"

export class LoggerProcess implements Process {
  public get priority(): PriorityInformation {
    return {}
  }

  public constructor(
    public readonly processId: ProcessId,
    public readonly parentProcessId: ProcessId
  ) {
  }

  public encode(): ProcessState {
    return {
      processType: "logger",
      processId: this.processId,
      state: {},
      childStates: [] // TODO:
    }
  }

  public decodeChildProcesses(childStates: ProcessState[]): Process[] {
    return [] // TODO:
  }

  // ---- API ---- //
  public log(): void {

  }
}

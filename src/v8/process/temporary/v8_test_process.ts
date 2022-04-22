import { Process, ProcessId, ProcessState } from "../process"

interface V8TestProcessState extends ProcessState {
  readonly t: "V8TestProcess"
}

export class V8TestProcess implements Process<void> {
  private constructor(
    public readonly processId: ProcessId,
  ) {
  }

  public encode(): V8TestProcessState {
    return {
      i: this.processId,
      t: "V8TestProcess",
    }
  }

  public run(): void {
    // TODO:
  }
}

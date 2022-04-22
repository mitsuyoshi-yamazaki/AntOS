import { Process, ProcessId, ProcessState } from "./process"

interface RootProcessState extends ProcessState {
  readonly t: "RootProcess"
}

export class RootProcess implements Process<void> {
  private constructor(
    public readonly processId: ProcessId,
  ) {
  }

  public encode(): RootProcessState {
    return {
      i: this.processId,
      t: "RootProcess",
    }
  }

  public run(): void {
    // TODO:
  }
}

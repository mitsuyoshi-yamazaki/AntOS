import { Procedural } from "task/procedural"
import { Process, ProcessId, ProcessState } from "task/process"

export interface LoggerProcessState extends ProcessState {
}

export class LoggerProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
  }

  public encode(): LoggerProcessState {
    return {
      t: "LoggerProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: LoggerProcessState): LoggerProcess {
    return new LoggerProcess(state.l, state.i)
  }

  public runOnTick(): void {

  }
}

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"

ProcessDecoder.register("ReportProcess", state => {
  return ReportProcess.decode(state as ReportProcessState)
})

interface ReportProcessState extends ProcessState {
}

export class ReportProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.identifier = `ReportProcess${launchTime}`
  }

  public encode(): ReportProcessState {
    return {
      t: "ReportProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: ReportProcessState): ReportProcess {
    return new ReportProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): ReportProcess {
    return new ReportProcess(Game.time, processId)
  }

  public processShortDescription(): string {
    return "" // TODO:
  }

  public runOnTick(): void {

  }
}

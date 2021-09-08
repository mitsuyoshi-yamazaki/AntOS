import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"

export interface EconomyProcessState extends ProcessState {
}

export class EconomyProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): EconomyProcessState {
    return {
      t: "EconomyProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: EconomyProcessState): EconomyProcess {
    return new EconomyProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): EconomyProcess {
    return new EconomyProcess(Game.time, processId)
  }

  public runOnTick(): void {

  }
}

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"

export interface PrioritizerProcessState extends ProcessState {
}

export class PrioritizerProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): PrioritizerProcessState {
    return {
      t: "PrioritizerProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: PrioritizerProcessState): PrioritizerProcess {
    return new PrioritizerProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): PrioritizerProcess {
    return new PrioritizerProcess(Game.time, processId)
  }

  public runOnTick(): void {

  }
}

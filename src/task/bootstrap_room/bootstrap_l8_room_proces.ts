import { Process, ProcessId, ProcessState } from "task/process"
import { BootstrapRoomObjective, BootstrapRoomObjectiveState } from "./bootstarp_room_objective"

export interface BootstrapRoomProcessState extends ProcessState {
  /** objective state */
  s: BootstrapRoomObjectiveState
}

export class BootstrapRoomProcess implements Process {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objective: BootstrapRoomObjective,
  ) { }

  public encode(): BootstrapRoomProcessState {
    return {
      t: "BootstrapRoomProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objective.encode(),
    }
  }

  public static decode(state: BootstrapRoomProcessState): BootstrapRoomProcess {
    const objective = BootstrapRoomObjective.decode(state.s)
    return new BootstrapRoomProcess(state.l, state.i, objective)
  }
}

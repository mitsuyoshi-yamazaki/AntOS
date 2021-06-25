import { Process, ProcessId, ProcessState } from "task/process"
import { BootstrapL8RoomObjective, BootstrapL8RoomObjectiveState } from "./bootstarp_l8_room_objective"

export interface BootstrapL8RoomProcessState extends ProcessState {
  /** objective state */
  s: BootstrapL8RoomObjectiveState
}

export class BootstrapL8RoomProcess implements Process {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objective: BootstrapL8RoomObjective,
  ) { }

  public encode(): BootstrapL8RoomProcessState {
    return {
      t: "BootstrapL8RoomProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objective.encode(),
    }
  }

  public static decode(state: BootstrapL8RoomProcessState): BootstrapL8RoomProcess {
    const objective = BootstrapL8RoomObjective.decode(state.s)
    return new BootstrapL8RoomProcess(state.l, state.i, objective)
  }
}

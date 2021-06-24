import { Process, ProcessId, ProcessState } from "task/process"
import { ClaimRoomObjective, ClaimRoomObjectiveState } from "./claim_room_objective"

export interface ClaimRoomProcessState extends ProcessState {
  /** objective state */
  s: ClaimRoomObjectiveState
}

export class ClaimRoomProcess implements Process {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objective: ClaimRoomObjective,
  ) { }

  public encode(): ClaimRoomProcessState {
    return {
      t: "ClaimRoomProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objective.encode(),
    }
  }

  public static decode(state: ClaimRoomProcessState): ClaimRoomProcess {
    const objective = ClaimRoomObjective.decode(state.s)
    return new ClaimRoomProcess(state.l, state.i, objective)
  }
}

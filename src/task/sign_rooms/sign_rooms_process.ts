import { Process, ProcessId, ProcessState } from "task/process"
import { SignRoomObjective, SignRoomObjectiveState } from "./sign_rooms_objective"

export interface SignRoomsProcessState extends ProcessState {
  /** objective state */
  s: SignRoomObjectiveState
}

export class SignRoomsProcess implements Process {

  public constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly objective: SignRoomObjective,
  ) {
  }

  public encode(): SignRoomsProcessState {
    return {
      t: "SignRoomsProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.objective.encode(),
    }
  }

  public static decode(state: SignRoomsProcessState): SignRoomsProcess | null {
    const objective = SignRoomObjective.decode(state.s)
    if (objective == null) {
      return null
    }
    return new SignRoomsProcess(
      state.l,
      state.i,
      objective,
    )
  }
}

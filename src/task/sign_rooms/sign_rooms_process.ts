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

  public static decode(state: SignRoomsProcessState): SignRoomsProcess {
    return new SignRoomsProcess(
      state.l,
      state.i,
      SignRoomObjective.decode(state.s),
    )
  }
}

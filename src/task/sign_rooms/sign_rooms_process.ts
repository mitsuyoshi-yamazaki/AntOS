import { Process, ProcessId, ProcessState } from "task/process"
import { SignRoomObjective, SignRoomObjectiveState } from "./sign_rooms_objective"

export interface SignRoomsProcessState extends ProcessState {
  /** objective state */
  s: SignRoomObjectiveState
}

/**
 * - Game.io("launch SignRoomsProcess base_room_name=W51S29 mark=😵 target_room_names=W52S29,W52S28,W53S29,W53S28")
 */
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

  public processDescription(): string {
    return this.objective.objectiveDescription()
  }
}

import { Process, ProcessId, ProcessState } from "../process";

interface OwnedRoomParentProcessState extends ProcessState {
  readonly t: "OwnedRoomParentProcess"

  readonly r: roomname
}

export class OwnedRoomParentProcess implements Process<void> {
  private constructor(
    public readonly processId: ProcessId,
    private readonly roomName: roomna
  ) {
  }

  public encode(): OwnedRoomParentProcessState {
    return {
      i: this.processId,
      t: "OwnedRoomParentProcess",
    }
  }

  public run(): void {
    // TODO:
  }
}

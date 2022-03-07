import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { ProcessId, ProcessState } from "../process"
import { OwnedRoomProcess } from "./owned_room_process"

interface OwnedRoomTestProcessState extends ProcessState {
  readonly t: "OwnedRoomTestProcess"
}

export class OwnedRoomTestProcess implements OwnedRoomProcess {
  private constructor(
    public readonly processId: ProcessId,
  ) {
  }

  public encode(): OwnedRoomTestProcessState {
    return {
      i: this.processId,
      t: "OwnedRoomTestProcess",
    }
  }

  public run(roomResource: OwnedRoomResource): void {
    // TODO:
  }
}

import { Process, ProcessDependencies, ProcessId } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

type ClaimRoomProcessState = {
  readonly r: RoomName  /// Room Name
}

ProcessDecoder.register("ClaimRoomProcess", (processId: ClaimRoomProcessId, state: ClaimRoomProcessState) => ClaimRoomProcess.decode(processId, state))

export type ClaimRoomProcessId = ProcessId<void, RoomName, void, ClaimRoomProcessState, ClaimRoomProcess>


export class ClaimRoomProcess extends Process<void, RoomName, void, ClaimRoomProcessState, ClaimRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: ClaimRoomProcessId,
    public readonly roomName: RoomName,
  ) {
    super()

    this.identifier = roomName
  }

  public encode(): ClaimRoomProcessState {
    return {
      r: this.roomName,
    }
  }

  public static decode(processId: ClaimRoomProcessId, state: ClaimRoomProcessState): ClaimRoomProcess {
    return new ClaimRoomProcess(processId, state.r)
  }

  public static create(processId: ClaimRoomProcessId, roomName: RoomName): ClaimRoomProcess {
    return new ClaimRoomProcess(processId, roomName)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return ConsoleUtility.roomLink(this.roomName)
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): void {
  }
}

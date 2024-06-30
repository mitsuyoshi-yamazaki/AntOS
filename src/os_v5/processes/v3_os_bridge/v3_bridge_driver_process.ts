import { Process, ProcessDefaultIdentifier, processDefaultIdentifier, ProcessDependencies, ProcessId } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { EmptySerializable } from "os_v5/utility/types"
import { RoomName } from "shared/utility/room_name_types"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomResources } from "room_resource/room_resources"


export type V3BridgeDriverProcessApi = {
  getOwnedRoomResource(roomName: RoomName): OwnedRoomResource | null
}


ProcessDecoder.register("V3BridgeDriverProcess", (processId: V3BridgeDriverProcessId) => V3BridgeDriverProcess.decode(processId))

export type V3BridgeDriverProcessId = ProcessId<void, ProcessDefaultIdentifier, V3BridgeDriverProcessApi, EmptySerializable, V3BridgeDriverProcess>


export class V3BridgeDriverProcess extends Process<void, ProcessDefaultIdentifier, V3BridgeDriverProcessApi, EmptySerializable, V3BridgeDriverProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: V3BridgeDriverProcessId,
  ) {
    super()
  }

  public encode(): EmptySerializable {
    return {}
  }

  public static decode(processId: V3BridgeDriverProcessId): V3BridgeDriverProcess {
    return new V3BridgeDriverProcess(processId)
  }

  public static create(processId: V3BridgeDriverProcessId): V3BridgeDriverProcess {
    return new V3BridgeDriverProcess(processId)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return ""
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): V3BridgeDriverProcessApi {
    return {
      getOwnedRoomResource: (roomName: RoomName): OwnedRoomResource | null => {
        return RoomResources.getOwnedRoomResource(roomName)
      },
    }
  }
}

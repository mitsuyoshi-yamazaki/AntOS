import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { CreepTaskStateManagementProcessApi } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"


type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi


type TrashResourceProcessState = {
  readonly r: RoomName
  readonly p?: RoomName
}

ProcessDecoder.register("TrashResourceProcess", (processId: TrashResourceProcessId, state: TrashResourceProcessState) => TrashResourceProcess.decode(processId, state))

export type TrashResourceProcessId = ProcessId<Dependency, RoomName, void, TrashResourceProcessState, TrashResourceProcess>


export class TrashResourceProcess extends Process<Dependency, RoomName, void, TrashResourceProcessState, TrashResourceProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }

  private constructor(
    public readonly processId: TrashResourceProcessId,
    public readonly roomName: RoomName,
    public readonly parentRoomName: RoomName,
  ) {
    super()
    this.identifier = roomName
  }

  public encode(): TrashResourceProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName === this.roomName ? undefined : this.parentRoomName,
    }
  }

  public static decode(processId: TrashResourceProcessId, state: TrashResourceProcessState): TrashResourceProcess {
    return new TrashResourceProcess(processId, state.r, state.p ?? state.r)
  }

  public static create(processId: TrashResourceProcessId, roomName: RoomName, parentRoomName: RoomName): TrashResourceProcess {
    return new TrashResourceProcess(processId, roomName, parentRoomName)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }
  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.parentRoomName)} => ${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): void {
  }
}

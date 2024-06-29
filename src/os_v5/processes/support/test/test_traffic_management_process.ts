import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { V3BridgeSpawnRequestProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepTrafficManagementProcessApi } from "os_v5/processes/game_object_management/creep/creep_traffic_management_process"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"


type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepTrafficManagementProcessApi
  & CreepDistributorProcessApi


type TestTrafficManagementProcessState = {
  readonly r: RoomName
  readonly p: RoomName
}

ProcessDecoder.register("TestTrafficManagementProcess", (processId: TestTrafficManagementProcessId, state: TestTrafficManagementProcessState) => TestTrafficManagementProcess.decode(processId, state))

export type TestTrafficManagementProcessId = ProcessId<Dependency, RoomName, void, TestTrafficManagementProcessState, TestTrafficManagementProcess>


export class TestTrafficManagementProcess extends Process<Dependency, RoomName, void, TestTrafficManagementProcessState, TestTrafficManagementProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTrafficManagementProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
    ],
  }

  private constructor(
    public readonly processId: TestTrafficManagementProcessId,
    public readonly roomName: RoomName,
    public readonly parentRoomName: RoomName,
  ) {
    super()
    this.identifier = roomName
  }

  public encode(): TestTrafficManagementProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName,
    }
  }

  public static decode(processId: TestTrafficManagementProcessId, state: TestTrafficManagementProcessState): TestTrafficManagementProcess {
    return new TestTrafficManagementProcess(processId, state.r, state.p)
  }

  public static create(processId: TestTrafficManagementProcessId, roomName: RoomName, parentRoomName: RoomName): TestTrafficManagementProcess {
    return new TestTrafficManagementProcess(processId, roomName, parentRoomName)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.parentRoomName)} => ${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(dependency: Dependency): string {
    const descriptions: string[] = [
      this.staticDescription(),
      `${dependency.countCreepsFor(this.processId)} creeps`,
    ]

    return descriptions.join(", ")
  }

  public run(dependency: Dependency): void {
  }
}

import { Process, ProcessDependencies, ProcessId } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

type EnergyHarvestRoomProcessState = {
  readonly r: RoomName
}

ProcessDecoder.register("EnergyHarvestRoomProcess", (processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState) => EnergyHarvestRoomProcess.decode(processId, state))

export type EnergyHarvestRoomProcessId = ProcessId<void, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess>


export class EnergyHarvestRoomProcess implements Process<void, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess> {
  public readonly identifier: RoomName
  public dependencies: ProcessDependencies = {
    driverNames: [],
    processes: [],
  }

  private constructor(
    public readonly processId: EnergyHarvestRoomProcessId,
    public readonly roomName: RoomName,
  ) {
    this.identifier = roomName
  }

  public encode(): EnergyHarvestRoomProcessState {
    return {
      r: this.roomName,
    }
  }

  public static decode(processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState): EnergyHarvestRoomProcess {
    return new EnergyHarvestRoomProcess(processId, state.r)
  }

  public static create(processId: EnergyHarvestRoomProcessId, roomName: RoomName): EnergyHarvestRoomProcess {
    return new EnergyHarvestRoomProcess(processId, roomName)
  }

  public getDependentData(): void { }

  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): void {
  }
}

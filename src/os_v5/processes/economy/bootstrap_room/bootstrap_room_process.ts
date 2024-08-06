import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { MitsuyoshiBotProcessApi } from "@private/os_v5/processes/bot/mitsuyoshi_bot/types"
import { RoomName } from "shared/utility/room_name_types"

type Dependency = MitsuyoshiBotProcessApi

type BootstrapRoomProcessState = {
  readonly r: RoomName    // Room name
  readonly id: string     // Bot identifier
}

ProcessDecoder.register("BootstrapRoomProcess", (processId: BootstrapRoomProcessId, state: BootstrapRoomProcessState) => BootstrapRoomProcess.decode(processId, state))

export type BootstrapRoomProcessId = ProcessId<Dependency, RoomName, void, BootstrapRoomProcessState, BootstrapRoomProcess>


export class BootstrapRoomProcess extends Process<Dependency, RoomName, void, BootstrapRoomProcessState, BootstrapRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
    ],
  }

  private constructor(
    public readonly processId: BootstrapRoomProcessId,
    public readonly roomName: RoomName,
    private readonly botIdentifier: string,
  ) {
    super()

    this.identifier = roomName
    this.dependencies.processes.push({processType: "MitsuyoshiBotProcess", identifier: botIdentifier})
  }

  public encode(): BootstrapRoomProcessState {
    return {
      r: this.roomName,
      id: this.botIdentifier,
    }
  }

  public static decode(processId: BootstrapRoomProcessId, state: BootstrapRoomProcessState): BootstrapRoomProcess {
    return new BootstrapRoomProcess(processId, state.r, state.id)
  }

  public static create(processId: BootstrapRoomProcessId, roomName: RoomName, botIdentifier: string): BootstrapRoomProcess {
    return new BootstrapRoomProcess(processId, roomName, botIdentifier)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
    ]

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(): void {
  }
}

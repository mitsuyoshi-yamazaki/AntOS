import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepDistributorProcessApi } from "../game_object_management/creep/creep_distributor_process"
import { CreepTrafficManagerProcessApi } from "@private/os_v5/processes/game_object_management/creep/creep_traffic_manager_process"

type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepDistributorProcessApi
  & CreepTrafficManagerProcessApi

type ScoutProcessState = {
  readonly p: RoomName  /// Parent room name
  readonly tr: RoomName /// Target room name
  readonly c?: true  /// Continuous
}

ProcessDecoder.register("ScoutProcess", (processId: ScoutProcessId, state: ScoutProcessState) => ScoutProcess.decode(processId, state))

export type ScoutProcessId = ProcessId<Dependency, RoomName, void, ScoutProcessState, ScoutProcess>


export class ScoutProcess extends Process<Dependency, RoomName, void, ScoutProcessState, ScoutProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private constructor(
    public readonly processId: ScoutProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly options: {
      readonly continuous: boolean,
    },
  ) {
    super()

    this.identifier = targetRoomName
  }

  public encode(): ScoutProcessState {
    return {
      p: this.parentRoomName,
      tr: this.targetRoomName,
      c: this.options.continuous ? true : undefined,
    }
  }

  public static decode(processId: ScoutProcessId, state: ScoutProcessState): ScoutProcess {
    const options = {
      continuous: state.c === true,
    }
    return new ScoutProcess(processId, state.p, state.tr, options)
  }

  public static create(processId: ScoutProcessId, parentRoomName: RoomName, targetRoomName: RoomName, options?: { continuous?: true }): ScoutProcess {
    const optionArguments = {
      continuous: options?.continuous === true,
    }
    return new ScoutProcess(processId, parentRoomName, targetRoomName, optionArguments)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
      ConsoleUtility.roomLink(this.targetRoomName),
    ]
    if (this.options.continuous === true) {
      descriptions.push("continuous")
    } else {
      descriptions.push("one time")
    }

    return descriptions.join(", ")
  }

  public runtimeDescription(dependency: Dependency): string {
    const descriptions: string[] = [
      this.staticDescription(),
    ]

    const creeps = dependency.getCreepsFor(this.processId)
    if (creeps[0] != null) {
      descriptions.push(`creep in ${creeps[0].pos}`)
    } else {
      descriptions.push("no creeps")
    }

    return descriptions.join(", ")
  }

  public run(dependency: Dependency): void {
  }
}

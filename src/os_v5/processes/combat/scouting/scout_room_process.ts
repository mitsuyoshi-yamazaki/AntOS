import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory, processDefaultIdentifier, ProcessSpecifier } from "os_v5/process/process"
import { processTypeDecodingMap, processTypeEncodingMap, SerializedProcessTypes } from "os_v5/process/process_type_map"
import { CreepProviderApi } from "os_v5/processes/bot/creep_provider_api"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { CreepTaskStateManagementProcessApi } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { Timestamp } from "shared/utility/timestamp"
import { ScoutRoomDelegate } from "./delegate"


// 「担当」をつくり、一部機能を委譲する
// それはProblemResolverのactionの一つではないのか
// 上から命令するだけではないのでインターフェースが異なる
// 対象Roomへの移動など
// 担当者が上から紹介される場合


type Dependency = ScoutRoomDelegate
  & CreepProviderApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi

type ScoutRoomProcessState = {
  readonly l: Timestamp /// Launch time
  readonly r: RoomName  /// Room Name
  readonly p: SerializedProcessTypes  /// Serialized parent process type
  readonly pi: string                 /// Parent identifier
}

ProcessDecoder.register("ScoutRoomProcess", (processId: ScoutRoomProcessId, state: ScoutRoomProcessState) => ScoutRoomProcess.decode(processId, state))

export type ScoutRoomProcessId = ProcessId<Dependency, RoomName, void, ScoutRoomProcessState, ScoutRoomProcess>


export class ScoutRoomProcess extends Process<Dependency, RoomName, void, ScoutRoomProcessState, ScoutRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string
  private readonly estimatedFinishTime: Timestamp
  private onTickDependency: Dependency | null = null

  private constructor(
    public readonly processId: ScoutRoomProcessId,
    public readonly launchTime: Timestamp,
    public readonly roomName: RoomName,
    private readonly parentProcessSpecifier: ProcessSpecifier,
  ) {
    super()

    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("ScoutRoomProcess", parseInt(processId, 36))
    this.dependencies.processes.push(parentProcessSpecifier)
    this.estimatedFinishTime = this.launchTime + 1500 // TODO: 正確な見積もりを出す
  }

  public encode(): ScoutRoomProcessState {
    return {
      l: this.launchTime,
      r: this.roomName,
      p: processTypeEncodingMap[this.parentProcessSpecifier.processType],
      pi: this.parentProcessSpecifier.identifier,
    }
  }

  public static decode(processId: ScoutRoomProcessId, state: ScoutRoomProcessState): ScoutRoomProcess {
    const parent: ProcessSpecifier = {
      processType: processTypeDecodingMap[state.p],
      identifier: state.pi,
    }
    return new ScoutRoomProcess(processId, state.l, state.r, parent)
  }

  public static create(processId: ScoutRoomProcessId, roomName: RoomName, parentProcessSpecifier: ProcessSpecifier): ScoutRoomProcess {
    return new ScoutRoomProcess(processId, Game.time, roomName, parentProcessSpecifier)
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

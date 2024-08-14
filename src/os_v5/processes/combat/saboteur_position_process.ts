import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory, processDefaultIdentifier } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { describePosition, Position } from "shared/utility/position_v2"
import { V3BridgeSpawnRequestProcessApi } from "../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepTaskStateManagementProcessApi } from "../game_object_management/creep/creep_task_state_management_process"
import { CreepDistributorProcessApi } from "../game_object_management/creep/creep_distributor_process"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepBody } from "utility/creep_body_v2"
import { CreepName } from "prototype/creep"

type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi

type PositionState = {
  readonly p: Position  /// Position
  c: CreepName | null   /// Creep name in position
  n: CreepName | null   /// Next creep name
}

type SaboteurPositionProcessState = {
  readonly r: RoomName    /// Room name
  readonly tr: RoomName   /// Target room name
  readonly w: RoomName[]  /// Waypoints
  readonly p: PositionState[]    /// Position
  readonly re: boolean    /// Ready
}

ProcessDecoder.register("SaboteurPositionProcess", (processId: SaboteurPositionProcessId, state: SaboteurPositionProcessState) => SaboteurPositionProcess.decode(processId, state))

export type SaboteurPositionProcessId = ProcessId<Dependency, string, void, SaboteurPositionProcessState, SaboteurPositionProcess>


export class SaboteurPositionProcess extends Process<Dependency, string, void, SaboteurPositionProcessState, SaboteurPositionProcess> {
  public readonly identifier: string
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: SaboteurPositionProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
    private readonly positionStates: PositionState[],
    private readonly ready: boolean,
  ) {
    super()

    const identifierDescription = ((): string => {
      if (positionStates[0] == null) {
        return "null"
      }
      return describePosition(positionStates[0].p)
    })()
    this.identifier = `${targetRoomName}_${identifierDescription}`
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
  }

  public encode(): SaboteurPositionProcessState {
    return {
      r: this.roomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      p: this.positionStates,
      re: this.ready,
    }
  }

  public static decode(processId: SaboteurPositionProcessId, state: SaboteurPositionProcessState): SaboteurPositionProcess {
    return new SaboteurPositionProcess(processId, state.r, state.tr, state.w, state.p, state.re)
  }

  public static create(processId: SaboteurPositionProcessId, roomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], positions: Position[]): SaboteurPositionProcess {
    const positionStates = positions.map((position): PositionState => ({p: position, c: null, n: null}))
    return new SaboteurPositionProcess(
      processId,
      roomName,
      targetRoomName,
      waypoints,
      positionStates,
      false,
    )
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
      // TODO: 配置についている状態
    ]

    return descriptions.join(", ")
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: Dependency): void {
    // const {spawned, spawning} = dependency.getSpawnedCreepsFor(this.processId)

    // const shouldSpawn = ((): boolean => {
    //   if (spawning.length > 0) {
    //     return false
    //   }
    //   if (spawned.length >= this.positions.length) {
    //     const oldestCreep = spawned.reduce((oldest, current) => oldest.ticksToLive < current.ticksToLive ? oldest : current)
    //     if (oldestCreep == null) {
    //       return true
    //     }
    //     if (oldestCreep.ticksToLive < 500) {
    //       return true
    //     }
    //     return false
    //   }

    //   const youngestCreep = spawned.reduce((youngest, current) => youngest.ticksToLive > current.ticksToLive ? youngest : current)
    //   if (youngestCreep == null) {
    //     return true
    //   }
    //   if (youngestCreep.ticksToLive < 1300) {
    //     return true
    //   }
    //   return false
    // })()

    // if (shouldSpawn === true) {
    //   this.spawn(dependency)
    // }

    // spawned.forEach()
  }

  private spawn(dependency: Dependency): void {
    dependency.addSpawnRequest(CreepBody.createWithBodyParts([MOVE]), this.roomName, { codename: this.codename })
  }
}

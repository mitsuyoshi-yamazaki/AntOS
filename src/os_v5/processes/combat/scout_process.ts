import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepDistributorProcessApi } from "../game_object_management/creep/creep_distributor_process"
import { CreepTrafficManagerProcessApi } from "@private/os_v5/processes/game_object_management/creep/creep_traffic_manager_process"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"

type MyCreepMemory = {
  //
}

type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepDistributorProcessApi
  & CreepTrafficManagerProcessApi

type ScoutProcessState = {
  readonly p: RoomName    /// Parent room name
  readonly tr: RoomName   /// Target room name
  readonly w: RoomName[]    /// Waypoints
  readonly c: number | null /// Remaining creep count: nullでは無限
}

ProcessDecoder.register("ScoutProcess", (processId: ScoutProcessId, state: ScoutProcessState) => ScoutProcess.decode(processId, state))

export type ScoutProcessId = ProcessId<Dependency, RoomName, void, ScoutProcessState, ScoutProcess>


export class ScoutProcess extends Process<Dependency, RoomName, void, ScoutProcessState, ScoutProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: ScoutProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
    private remainingScoutCount: number | null,
  ) {
    super()

    this.identifier = targetRoomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
  }

  public encode(): ScoutProcessState {
    return {
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      c: this.remainingScoutCount,
    }
  }

  public static decode(processId: ScoutProcessId, state: ScoutProcessState): ScoutProcess {
    return new ScoutProcess(processId, state.p, state.tr, state.w, state.c)
  }

  public static create(processId: ScoutProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], options?: { creepCount?: number }): ScoutProcess {
    return new ScoutProcess(processId, parentRoomName, targetRoomName, waypoints, options?.creepCount ?? null)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
      ConsoleUtility.roomLink(this.targetRoomName),
    ]
    if (this.remainingScoutCount == null) {
      descriptions.push("continuous")
    } else {
      descriptions.push(`${this.remainingScoutCount} times left`)
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
    const creep = dependency.getCreepsFor(this.processId)[0]
    if (creep == null) {
      this.spawnScout(dependency)
      return
    }

    if (this.remainingScoutCount != null && creep.ticksToLive != null && creep.ticksToLive === 1499) {
      this.remainingScoutCount -= 1
    }

    const scout = dependency.registerTrafficManagedCreep(creep)
    if (scout.trafficManager.moving == null) {
      scout.trafficManager.moveToRoom(this.targetRoomName, {waypoints: [...this.waypoints]})
    }
  }

  private spawnScout(dependency: Dependency): void {
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, {})
    dependency.addSpawnRequest<MyCreepMemory>(CreepBody.createWithBodyParts([MOVE]), this.parentRoomName, { codename: this.codename, memory })
  }
}

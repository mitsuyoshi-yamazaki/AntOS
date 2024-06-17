import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessAPI } from "../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepName } from "prototype/creep"

type EnergyHarvestRoomProcessState = {
  readonly r: RoomName
  readonly p: RoomName

  readonly c: CreepName
}

type EnergyHarvestRoomProcessDependency = Pick<V3BridgeSpawnRequestProcessAPI, "addSpawnRequest">

ProcessDecoder.register("EnergyHarvestRoomProcess", (processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState) => EnergyHarvestRoomProcess.decode(processId, state))

export type EnergyHarvestRoomProcessId = ProcessId<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess>


export class EnergyHarvestRoomProcess implements Process<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    driverNames: [],
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", processSpecifier: "V3SpawnRequest" },
    ],
  }

  private readonly codename: string
  private readonly creepName: CreepName

  private constructor(
    public readonly processId: EnergyHarvestRoomProcessId,
    private readonly roomName: RoomName,
    private readonly parentRoomName: RoomName,
    creepName: CreepName | null,
  ) {
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
    this.creepName = creepName ?? SystemCalls.uniqueName.generate(this.codename)
  }

  public encode(): EnergyHarvestRoomProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName,
      c: this.creepName,
    }
  }

  public static decode(processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState): EnergyHarvestRoomProcess {
    return new EnergyHarvestRoomProcess(processId, state.r, state.p, state.c)
  }

  public static create(processId: EnergyHarvestRoomProcessId, roomName: RoomName, parentRoomName: RoomName): EnergyHarvestRoomProcess {
    return new EnergyHarvestRoomProcess(processId, roomName, parentRoomName, null)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): EnergyHarvestRoomProcessDependency | null {
    return sharedMemory.get("V3BridgeSpawnRequestProcess", "V3SpawnRequest")
  }

  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.parentRoomName)} => ${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: EnergyHarvestRoomProcessDependency): void {
    const creep = Game.creeps[this.creepName]
    if (creep == null) {
      dependency.addSpawnRequest(new CreepBody([WORK, TOUGH]), this.parentRoomName, { uniqueCreepName: this.creepName })
      return
    }

    creep.say("Hey")
  }
}

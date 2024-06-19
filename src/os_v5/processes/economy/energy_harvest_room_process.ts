import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessAPI } from "../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepName } from "prototype/creep"
import { ArgumentParser } from "os_v5/utility/argument_parser/argument_parser"

type EnergyHarvestRoomProcessState = {
  readonly r: RoomName
  readonly p: RoomName

  readonly c: CreepName
}

type EnergyHarvestRoomProcessDependency = Pick<V3BridgeSpawnRequestProcessAPI, "addSpawnRequest">

ProcessDecoder.register("EnergyHarvestRoomProcess", (processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState) => EnergyHarvestRoomProcess.decode(processId, state))

export type EnergyHarvestRoomProcessId = ProcessId<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess>


export class EnergyHarvestRoomProcess extends Process<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: "V3SpawnRequest" },
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
    super()
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

  /** @throws */
  public didReceiveMessage(args: string[]): string {
    const argumentParser = new ArgumentParser(args)

    return "ok"
  }

  public didLaunch(): void {
    if (Memory.ignoreRooms.includes(this.roomName) !== true) { // !!UNSAFE MEMORY ACCESS!!
      Memory.ignoreRooms.push(this.roomName)
      console.log(`${ConsoleUtility.colored("!!UNSAFE MEMORY ACCESS!!", "warn")} ${this.processType}[${this.identifier}] added ${ConsoleUtility.roomLink(this.roomName)} to ignoreRooms`)
    }
  }

  public willTerminate(): void {
    const index = Memory.ignoreRooms.indexOf(this.roomName) // !!UNSAFE MEMORY ACCESS!!
    if (index >= 0) {
      Memory.ignoreRooms.splice(index, 1)
    }
  }

  public run(dependency: EnergyHarvestRoomProcessDependency): void {
    const creep = Game.creeps[this.creepName]
    if (creep == null) {
      dependency.addSpawnRequest(new CreepBody([MOVE]), this.parentRoomName, { uniqueCreepName: this.creepName })
      return
    }

    creep.say("Hey")
  }
}

import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepName } from "prototype/creep"
import { ArgumentParser } from "os_v5/utility/argument_parser/argument_parser"
import { RoomPathfindingProcessApi } from "../game_object_management/room_pathfinding_process"
import { positionFromExit } from "shared/utility/room_exit"

/**
# EnergyHarvestRoomProcess
## 概要
- そのRoomのEnergyを採掘するだけの、Ownedなリモート部屋
 */

type EnergyHarvestRoomProcessState = {
  readonly r: RoomName
  readonly p: RoomName

  readonly c: CreepName
}

type EnergyHarvestRoomProcessDependency = Pick<V3BridgeSpawnRequestProcessApi, "addSpawnRequest">
  & Pick<RoomPathfindingProcessApi, "exitTo">

ProcessDecoder.register("EnergyHarvestRoomProcess", (processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState) => EnergyHarvestRoomProcess.decode(processId, state))

export type EnergyHarvestRoomProcessId = ProcessId<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess>


export class EnergyHarvestRoomProcess extends Process<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: "V3SpawnRequest" },
      { processType: "RoomPathfindingProcess", identifier: "RoomPathFinding" },
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
    const spawnRequestApi: V3BridgeSpawnRequestProcessApi | null = sharedMemory.get("V3BridgeSpawnRequestProcess", "V3SpawnRequest")
    const pathfindingApi: RoomPathfindingProcessApi | null = sharedMemory.get("RoomPathfindingProcess", "RoomPathFinding")
    if (spawnRequestApi == null || pathfindingApi == null) {
      return null
    }
    return {
      ...spawnRequestApi,
      ...pathfindingApi,
    }
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

    if (creep.room.name === this.roomName) {
      creep.say("Yo")
      return
    }

    const result = dependency.exitTo(this.roomName, creep.room.name)
    switch (result.case) {
    case "succeeded": {
      const exitPosition = positionFromExit(result.value)
      creep.say("Hey")
      creep.moveTo(exitPosition.x, exitPosition.y)
      return
    }

    case "failed":
      creep.say("Omg")
      creep.suicide()
      return

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = result
      return
    }
    }
  }
}

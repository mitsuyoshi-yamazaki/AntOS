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
import { CreepDistributorProcessApi } from "../game_object_management/creep/creep_distributor_process"
import { V5Creep } from "os_v5/utility/game_object/creep"

/**
# EnergyHarvestRoomProcess
## 概要
- そのRoomのEnergyを採掘するだけの、Ownedなリモート部屋
 */

type MyCreepMemory = Record<string, never>
type MyCreep = V5Creep<MyCreepMemory>

type EnergyHarvestRoomProcessState = {
  readonly r: RoomName
  readonly p: RoomName

  c: CreepName | null
}

type EnergyHarvestRoomProcessDependency = Pick<V3BridgeSpawnRequestProcessApi, "addSpawnRequest">
  & Pick<RoomPathfindingProcessApi, "exitTo">
  & CreepDistributorProcessApi

ProcessDecoder.register("EnergyHarvestRoomProcess", (processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState) => EnergyHarvestRoomProcess.decode(processId, state))

export type EnergyHarvestRoomProcessId = ProcessId<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess>


export class EnergyHarvestRoomProcess extends Process<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: "V3SpawnRequest" },
      { processType: "RoomPathfindingProcess", identifier: "RoomPathFinding" },
      { processType: "CreepDistributorProcess", identifier: "CreepDistributor" },
    ],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: EnergyHarvestRoomProcessId,
    private readonly roomName: RoomName,
    private readonly parentRoomName: RoomName,
    private creepName: CreepName | null,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
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
    return this.getFlatDependentData(sharedMemory)
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
    const creep = this.getCreep(dependency)
    if (creep == null) {
      return
    }

    if (creep.ticksToLive == null) {  // spawning
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

  private getCreep(dependency: EnergyHarvestRoomProcessDependency): MyCreep | null {
    if (this.creepName == null) {
      const creeps = dependency.getCreepsFor<MyCreepMemory>(this.processId)
      if (creeps[0] != null) {
        return creeps[0]
      }
      this.spawnCreep(dependency)
      return null
    }

    const creep = Game.creeps[this.creepName]
    if (creep != null) {
      return creep as unknown as MyCreep
    }

    this.creepName = null
    this.spawnCreep(dependency)
    return null
  }

  private spawnCreep(dependency: EnergyHarvestRoomProcessDependency): void {
    const memory = dependency.createSpawnCreepMemoryFor(this.processId, {})
    dependency.addSpawnRequest(new CreepBody([MOVE]), this.parentRoomName, { codename: this.codename, memory })
  }
}

import { StaticMonoCreepBuildRoomProcess, StaticMonoCreepBuildRoomProcessId } from "./static_mono_creep_build_room_process"

// Import
import { BotSpecifier, Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { SystemCalls } from "os_v5/system_calls/interface"
import { BotTypes } from "os_v5/process/process_type_map"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { isMyRoom } from "shared/utility/room"


/**
# StaticMonoCreepKeeperRoomProcess
## 概要
- そのRoomのEnergyを採掘するだけの、Ownedなリモート部屋
- HarvesterがUpgradeできる配置のみに対応

## 仕様
- 問題が起きたらそのまま殺す
 */

export type StaticMonoCreepKeeperRoomProcessApi = {
  readonly parentV3RoomName: RoomName
  readonly controller: StructureController | null
}

type Dependency = CreepDistributorProcessApi

type StaticMonoCreepKeeperRoomProcessState = {
  readonly r: RoomName  /// Room name
  readonly p: RoomName  /// Parent room name
  readonly bp?: StaticMonoCreepBuildRoomProcessId
  readonly b: {
    readonly t: BotTypes
    readonly i: string  /// Bot process identifier
  } | null
}


ProcessDecoder.register("StaticMonoCreepKeeperRoomProcess", (processId: StaticMonoCreepKeeperRoomProcessId, state: StaticMonoCreepKeeperRoomProcessState) => StaticMonoCreepKeeperRoomProcess.decode(processId, state))

export type StaticMonoCreepKeeperRoomProcessId = ProcessId<Dependency, RoomName, void, StaticMonoCreepKeeperRoomProcessState, StaticMonoCreepKeeperRoomProcess>


export class StaticMonoCreepKeeperRoomProcess extends Process<Dependency, RoomName, void, StaticMonoCreepKeeperRoomProcessState, StaticMonoCreepKeeperRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: StaticMonoCreepKeeperRoomProcessId,
    private readonly roomName: RoomName,
    private readonly parentRoomName: RoomName,
    private buildProcessId: StaticMonoCreepBuildRoomProcessId | undefined,
    private readonly botProcessSpecifier: BotSpecifier | null,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))

    if (this.botProcessSpecifier != null) {
      this.dependencies.processes.push(this.botProcessSpecifier)
    }
  }

  public encode(): StaticMonoCreepKeeperRoomProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName,
      bp: this.buildProcessId,
      b: this.botProcessSpecifier == null ? null : {
        t: this.botProcessSpecifier.processType,
        i: this.botProcessSpecifier.identifier,
      },
    }
  }

  public static decode(processId: StaticMonoCreepKeeperRoomProcessId, state: StaticMonoCreepKeeperRoomProcessState): StaticMonoCreepKeeperRoomProcess {
    const botSpecifier: BotSpecifier | null = state.b == null ? null : {
      processType: state.b.t,
      identifier: state.b.i,
    }
    return new StaticMonoCreepKeeperRoomProcess(processId, state.r, state.p, state.bp, botSpecifier)
  }

  public static create(processId: StaticMonoCreepKeeperRoomProcessId, roomName: RoomName, parentRoomName: RoomName, options?: { botSpecifier?: BotSpecifier }): StaticMonoCreepKeeperRoomProcess {
    return new StaticMonoCreepKeeperRoomProcess(
      processId,
      roomName,
      parentRoomName,
      undefined,
      options?.botSpecifier ?? null
    )
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.parentRoomName)} => ${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(dependency: Dependency): string {
    const creeps = dependency.getCreepsFor(this.processId)
    const descriptions: string[] = [
      this.staticDescription(),
      `${creeps.length} creeps`,
    ]

    if (creeps.length <= 1 && creeps[0] != null) {
      descriptions.push(`at ${creeps[0].pos}`)
    }

    return descriptions.join(", ")
  }

  /** @throws */
  public didLaunch(): void {
    if (Memory.ignoreRooms.includes(this.roomName) !== true) { // !!UNSAFE MEMORY ACCESS!!
      Memory.ignoreRooms.push(this.roomName)
      SystemCalls.logger.log(this, `${ConsoleUtility.colored("!!UNSAFE MEMORY ACCESS!!", "warn")} Added ${ConsoleUtility.roomLink(this.roomName)} to ignoreRooms`, true)
    }
  }

  public willTerminate(): void {
    const index = Memory.ignoreRooms.indexOf(this.roomName) // !!UNSAFE MEMORY ACCESS!!
    if (index >= 0) {
      Memory.ignoreRooms.splice(index, 1)
      SystemCalls.logger.log(this, `${ConsoleUtility.colored("!!UNSAFE MEMORY ACCESS!!", "warn")} Removed ${ConsoleUtility.roomLink(this.roomName)} to ignoreRooms`, true)
    }
  }

  public run(dependency: Dependency): StaticMonoCreepKeeperRoomProcessApi {
    const room = Game.rooms[this.roomName]
    if (room != null && isMyRoom(room)) {
      if (this.buildProcessId == null && room.controller.level < 8) {
        try {
          this.buildProcessId = this.launchBuildProcess()
        } catch (error) {
          SystemCalls.logger.fatal(this, "Cannot launch StaticMonoCreepBuildRoomProcess")
          SystemCalls.processManager.suspend(this)
        }
        return {
          parentV3RoomName: this.parentRoomName,
          controller: room?.controller ?? null,
        }
      }
    }

    return {
      parentV3RoomName: this.parentRoomName,
      controller: room?.controller ?? null,
    }
  }

  // Private
  /** @throws */
  private launchBuildProcess(): StaticMonoCreepBuildRoomProcessId {
    const process: StaticMonoCreepBuildRoomProcess = SystemCalls.processManager.addProcess(processId => StaticMonoCreepBuildRoomProcess.create(processId as StaticMonoCreepBuildRoomProcessId, this.roomName))
    return process.processId
  }
}

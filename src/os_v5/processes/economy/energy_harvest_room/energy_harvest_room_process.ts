import { Process, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "../../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ArgumentParser } from "os_v5/utility/argument_parser/argument_parser"
import { RoomPathfindingProcessApi } from "../../game_object_management/room_pathfinding_process"
import { CreepDistributorProcessApi } from "../../game_object_management/creep/creep_distributor_process"
import { CreepTaskStateManagementProcessApi, TaskDrivenCreep, TaskDrivenCreepMemory } from "../../game_object_management/creep/creep_task_state_management_process"
import { CreepTask } from "../../game_object_management/creep/creep_task/creep_task"

/**
# EnergyHarvestRoomProcess
## 概要
- そのRoomのEnergyを採掘するだけの、Ownedなリモート部屋
 */

type CreepRoles = "worker" | "claimer"
type MyCreep = TaskDrivenCreep<CreepRoles>
type MyCreepMemory = TaskDrivenCreepMemory<CreepRoles>

type EnergyHarvestRoomProcessState = {
  readonly r: RoomName
  readonly p: RoomName
}

type EnergyHarvestRoomProcessDependency = Pick<V3BridgeSpawnRequestProcessApi, "addSpawnRequest">
  & Pick<RoomPathfindingProcessApi, "exitTo">
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi

ProcessDecoder.register("EnergyHarvestRoomProcess", (processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState) => EnergyHarvestRoomProcess.decode(processId, state))

export type EnergyHarvestRoomProcessId = ProcessId<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess>


export class EnergyHarvestRoomProcess extends Process<EnergyHarvestRoomProcessDependency, RoomName, void, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: "V3SpawnRequest" },
      { processType: "RoomPathfindingProcess", identifier: "RoomPathFinding" },
      { processType: "CreepDistributorProcess", identifier: "CreepDistributor" },
      { processType: "CreepTaskStateManagementProcess", identifier: "CreepTaskStateManagement" },
    ],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: EnergyHarvestRoomProcessId,
    private readonly roomName: RoomName,
    private readonly parentRoomName: RoomName,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
  }

  public encode(): EnergyHarvestRoomProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName,
    }
  }

  public static decode(processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState): EnergyHarvestRoomProcess {
    return new EnergyHarvestRoomProcess(processId, state.r, state.p)
  }

  public static create(processId: EnergyHarvestRoomProcessId, roomName: RoomName, parentRoomName: RoomName): EnergyHarvestRoomProcess {
    return new EnergyHarvestRoomProcess(processId, roomName, parentRoomName)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): EnergyHarvestRoomProcessDependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.parentRoomName)} => ${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(dependency: EnergyHarvestRoomProcessDependency): string {
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
    const creeps = dependency.getCreepsFor(this.processId)
    if (creeps.length <= 0) {
      this.spawnCreep(dependency)
      return
    }

    const creepsWithTask = dependency.registerTaskDrivenCreeps<CreepRoles>(creeps)
    creepsWithTask.forEach(creep => {
      if (creep.task == null) {
        creep.say("assign")
        creep.task = this.taskFor(creep)
      } else {
        creep.say("🚶")
      }
    })
  }

  private taskFor(creep: MyCreep): CreepTask.AnyTask | null {
    const source = creep.room.find(FIND_SOURCES_ACTIVE)[0]
    if (source == null) {
      creep.say("meh")
      return null
    }

    const tasks: CreepTask.AnyTask[] = [
      CreepTask.Tasks.MoveTo.create(source.pos),
      CreepTask.Tasks.HarvestEnergy.create(source.id),
    ]
    return CreepTask.Tasks.Sequential.create(tasks)
  }

  private spawnCreep(dependency: EnergyHarvestRoomProcessDependency): void {
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, {t: null, r: "worker"})
    dependency.addSpawnRequest(new CreepBody([MOVE, WORK, CARRY]), this.parentRoomName, { codename: this.codename, memory })
  }
}

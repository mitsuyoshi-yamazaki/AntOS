// Import
import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepTask } from "../../game_object_management/creep/creep_task/creep_task"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import { V3BridgeSpawnRequestProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { RoomResourceClaimed, StaticMonoCreepKeeperRoomProcessApi } from "./static_mono_creep_keeper_room_process"
import { CreepTaskStateManagementProcessApi, TaskDrivenCreep, TaskDrivenCreepMemory } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import { GameConstants } from "utility/constants"


type CreepRole = "claimer" | "worker"
// eslint-disable-next-line @typescript-eslint/ban-types
type CreepMemoryExtension = {
}
type MyCreep = TaskDrivenCreep<CreepRole, CreepMemoryExtension>
type MyCreepMemory = TaskDrivenCreepMemory<CreepRole> & CreepMemoryExtension


type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi
  & StaticMonoCreepKeeperRoomProcessApi

type StaticMonoCreepBuildRoomProcessState = {
  readonly r: RoomName  /// Room name
}


ProcessDecoder.register("StaticMonoCreepBuildRoomProcess", (processId: StaticMonoCreepBuildRoomProcessId, state: StaticMonoCreepBuildRoomProcessState) => StaticMonoCreepBuildRoomProcess.decode(processId, state))

export type StaticMonoCreepBuildRoomProcessId = ProcessId<Dependency, RoomName, void, StaticMonoCreepBuildRoomProcessState, StaticMonoCreepBuildRoomProcess>


export class StaticMonoCreepBuildRoomProcess extends Process<Dependency, RoomName, void, StaticMonoCreepBuildRoomProcessState, StaticMonoCreepBuildRoomProcess> {
  public readonly identifier: RoomName
  public getLinkedIdentifier(): string {
    return ConsoleUtility.roomLink(this.identifier)
  }

  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: StaticMonoCreepBuildRoomProcessId,
    private readonly roomName: RoomName,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))

    this.dependencies.processes.push({ processType: "StaticMonoCreepKeeperRoomProcess", identifier: roomName })
  }

  public encode(): StaticMonoCreepBuildRoomProcessState {
    return {
      r: this.roomName,
    }
  }

  public static decode(processId: StaticMonoCreepBuildRoomProcessId, state: StaticMonoCreepBuildRoomProcessState): StaticMonoCreepBuildRoomProcess {
    return new StaticMonoCreepBuildRoomProcess(processId, state.r)
  }

  public static create(processId: StaticMonoCreepBuildRoomProcessId, roomName: RoomName): StaticMonoCreepBuildRoomProcess {
    return new StaticMonoCreepBuildRoomProcess(
      processId,
      roomName,
    )
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.roomName)}`
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

  public run(dependency: Dependency): void {
    const creeps = this.getMyCreeps(dependency)

    switch (dependency.roomResource.case) {
    case "not_claimed":
      // TODO:
      return
    case "claimed":
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = dependency.roomResource
      return
    }
    }

    const workers = creeps.get("worker")
    if (workers == null || workers[0] == null) {
      this.spawnWorker(dependency)
      return
    }
    this.runWorker(workers[0], dependency.roomResource)
  }

  // Private
  private getMyCreeps(dependency: Dependency): Map<CreepRole, MyCreep[]> {
    const creeps = dependency.getCreepsFor(this.processId)
    const creepsWithTask = dependency.registerTaskDrivenCreeps<CreepRole, CreepMemoryExtension>(creeps)

    const creepsByRole = new ValuedArrayMap<CreepRole, MyCreep>()
    creepsWithTask.forEach(creep => {
      creepsByRole.getValueFor(creep.memory.r).push(creep)
    })
    return creepsByRole
  }

  private spawnWorker(dependency: Dependency): void {
    const body = [
      WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      WORK, WORK, WORK, WORK, WORK,
      MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
      WORK, WORK,
      MOVE,
    ]
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, { t: null, r: "worker" })
    dependency.addSpawnRequest<CreepMemoryExtension>(CreepBody.createWithBodyParts(body), dependency.parentV3RoomName, { codename: this.codename, memory })
  }

  private runWorker(creep: MyCreep, roomResource: RoomResourceClaimed): void {
    if (creep.task != null) {
      return
    }
    creep.task = this.workerTaskFor(creep, roomResource)
  }

  private workerTaskFor(creep: MyCreep, roomResource: RoomResourceClaimed): CreepTask.AnyTask | null {
    if (creep.room.name !== this.roomName) {
      return CreepTask.Tasks.MoveToRoom.create(this.roomName, [])
    }

    const consumeEnergyTasks = ((): CreepTask.AnyTask[] => {
      if (roomResource.controller.ticksToDowngrade < 10000) {
        return [CreepTask.Tasks.UpgradeController.create(roomResource.controller.id)]
      }
      const constructionSite = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES)
      if (constructionSite != null) {
        return [CreepTask.Tasks.Build.create(constructionSite.id)]
      }
      return [CreepTask.Tasks.UpgradeController.create(roomResource.controller.id)]
    })()

    const tasks: CreepTask.AnyTask[] = [
      CreepTask.Tasks.MoveTo.create(roomResource.source.pos, GameConstants.creep.actionRange.harvest),
      CreepTask.Tasks.HarvestEnergy.create(roomResource.source.id),
      // CreepTask.Tasks.MoveTo.create(roomResource.controller.pos, GameConstants.creep.actionRange.upgradeController), // 不要のはず
      ...consumeEnergyTasks,
    ]

    return CreepTask.Tasks.Sequential.create(tasks)
  }
}

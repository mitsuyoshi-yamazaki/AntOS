import { AnyProcessId, BotSpecifier, Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "../../v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { ArgumentParser } from "os_v5/utility/argument_parser/argument_parser"
import { CreepDistributorProcessApi } from "../../game_object_management/creep/creep_distributor_process"
import { CreepTaskStateManagementProcessApi, TaskDrivenCreep, TaskDrivenCreepMemory } from "../../game_object_management/creep/creep_task_state_management_process"
import { CreepTask } from "../../game_object_management/creep/creep_task/creep_task"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import { BotApi } from "os_v5/processes/bot/types"
import { BotTypes } from "os_v5/process/process_type_map"
import { DeferredTaskId, deferredTaskPriority, DeferredTaskResult } from "os_v5/system_calls/depended_system_calls/deferred_task"

// Energy Harvest Room
import { EnergyHarvestRoomResource, EnergyHarvestRoomResourceState } from "./energy_harvest_room_resource"
// import { } from "./energy_harvest_room_state_machine"
import { EnergyHarvestRoomLayoutMaker } from "./energy_harvest_room_layout_maker"


/**
# EnergyHarvestRoomProcess
## 概要
- そのRoomのEnergyを採掘するだけの、Ownedなリモート部屋
 */


type CreepRoles = "worker" | "claimer" | "distributor" | "puller"
type CreepMemoryExtension = {
  tempState: "harvesting" | "working"
}
type MyCreep = TaskDrivenCreep<CreepRoles, CreepMemoryExtension>
type MyCreepMemory = TaskDrivenCreepMemory<CreepRoles> & CreepMemoryExtension


type DeferredTaskType = "make layout"


type EnergyHarvestRoomProcessApi = {
  readonly roomResource: EnergyHarvestRoomResource | null,
}


type EnergyHarvestRoomProcessState = {
  readonly r: RoomName  /// Room name
  readonly p: RoomName  /// Parent room name
  readonly rr: EnergyHarvestRoomResourceState | null
  readonly dt: [DeferredTaskType, DeferredTaskId][]
  readonly b: {
    readonly t: BotTypes
    readonly i: string  /// Bot process identifier
  } | null
}

type Dependency = Pick<V3BridgeSpawnRequestProcessApi, "addSpawnRequest">
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi
  & Partial<BotApi>

ProcessDecoder.register("EnergyHarvestRoomProcess", (processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState) => EnergyHarvestRoomProcess.decode(processId, state))

export type EnergyHarvestRoomProcessId = ProcessId<Dependency, RoomName, EnergyHarvestRoomProcessApi, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess>


export class EnergyHarvestRoomProcess extends Process<Dependency, RoomName, EnergyHarvestRoomProcessApi, EnergyHarvestRoomProcessState, EnergyHarvestRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }

  private roomResource: EnergyHarvestRoomResource | null
  private roomResourceStateCache: EnergyHarvestRoomResourceState | null
  private roomResourceGenerationResult: "succeeded" | "failed" | null = null
  private readonly codename: string

  private constructor(
    public readonly processId: EnergyHarvestRoomProcessId,
    private readonly roomName: RoomName,
    private readonly parentRoomName: RoomName,
    roomResourceState: EnergyHarvestRoomResourceState | null,
    private readonly queuingDeferredTasks: Map<DeferredTaskType, DeferredTaskId>,
    private readonly botProcessSpecifier: BotSpecifier | null,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))

    const [roomResource, roomResourceStateCache] = ((): [EnergyHarvestRoomResource | null, EnergyHarvestRoomResourceState | null] => {
      if (roomResourceState == null) {
        return [null, null]
      }
      const room = Game.rooms[roomName]
      if (room?.controller == null) {
        return [null, roomResourceState]
      }
      return [
        EnergyHarvestRoomResource.decode(roomResourceState, room.controller),
        null,
      ]
    })()

    this.roomResource = roomResource
    this.roomResourceStateCache = roomResourceStateCache

    if (this.botProcessSpecifier != null) {
      this.dependencies.processes.push(this.botProcessSpecifier)
    }
  }

  public encode(): EnergyHarvestRoomProcessState {
    if (this.roomResource != null) {
      this.roomResourceStateCache = this.roomResource.encode()
    }

    return {
      r: this.roomName,
      p: this.parentRoomName,
      rr: this.roomResourceStateCache,
      dt: Array.from(this.queuingDeferredTasks.entries()).map(([taskType, taskId]): [DeferredTaskType, DeferredTaskId] => [taskType, taskId]),
      b: this.botProcessSpecifier == null ? null : {
        t: this.botProcessSpecifier.processType,
        i: this.botProcessSpecifier.identifier,
      },
    }
  }

  public static decode(processId: EnergyHarvestRoomProcessId, state: EnergyHarvestRoomProcessState): EnergyHarvestRoomProcess {
    const botSpecifier: BotSpecifier | null = state.b == null ? null : {
      processType: state.b.t,
      identifier: state.b.i,
    }
    const queuingDeferredTasks = new Map<DeferredTaskType, DeferredTaskId>()
    state.dt.forEach(([taskType, taskId]) => queuingDeferredTasks.set(taskType, taskId))
    return new EnergyHarvestRoomProcess(processId, state.r, state.p, state.rr, queuingDeferredTasks, botSpecifier)
  }

  public static create(processId: EnergyHarvestRoomProcessId, roomName: RoomName, parentRoomName: RoomName, options?: {botSpecifier?: BotSpecifier}): EnergyHarvestRoomProcess {
    return new EnergyHarvestRoomProcess(
      processId,
      roomName,
      parentRoomName,
      null,
      new Map<DeferredTaskType, DeferredTaskId>(),
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
  public didReceiveMessage(args: string[]): string {
    const argumentParser = new ArgumentParser(args)

    return "ok"
  }

  /** @throws */
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

  public run(dependency: Dependency): EnergyHarvestRoomProcessApi {
    const room = Game.rooms[this.roomName]
    const creepsByRole = this.getMyCreeps(dependency)

    if (room == null || room.controller?.my !== true) {
      if ((creepsByRole.get("claimer")?.length ?? 0) <= 0) {
        this.spawnClaimer(dependency)
      }
      return {
        roomResource: null,
      }
    }

    if (this.roomResource == null) {
      if (this.roomResourceGenerationResult !== "failed" && this.queuingDeferredTasks.get("make layout") == null) {

        const controller = room.controller
        const taskId = SystemCalls.deferredTaskManager.register<DeferredTaskType, EnergyHarvestRoomResource | null>(
          this.processId as AnyProcessId,
          "make layout",
          (): EnergyHarvestRoomResource => {
            return (new EnergyHarvestRoomLayoutMaker(controller)).makeLayout()
          },
          {
            priority: deferredTaskPriority.low,
          },
        )

        this.queuingDeferredTasks.set("make layout", taskId)
      }
    }

    const workers = creepsByRole.get("worker")
    if (workers == null || workers.length <= 0) {
      this.spawnWorker(dependency)
    } else {
      this.runWorkers(workers)
    }

    return {
      roomResource: this.roomResource,
    }
  }

  public didFinishDeferredTask(taskResult: DeferredTaskResult<DeferredTaskType, EnergyHarvestRoomResource>): void {
    switch (taskResult.result.case) {
    case "succeeded":
      this.roomResourceGenerationResult = "succeeded"
      this.queuingDeferredTasks.delete(taskResult.taskType)
      this.roomResource = taskResult.result.value
      this.destroyStructures(taskResult.result.value.room)  // ここで行うのは、roomResource が算出される際に残しておくべき Structure の判断も行う想定のため
      console.log(`${this} room resource succeeded`)  // FixMe:
      return
    case "failed":
      this.roomResourceGenerationResult = "failed"
      this.queuingDeferredTasks.delete(taskResult.taskType)
      console.log(`${this} room resource failed`)  // FixMe:
      return
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = taskResult.result
      return
    }
    }
  }

  // Private
  private runWorkers(workers: MyCreep[]): void {
    workers.forEach(creep => {
      if (creep.task != null) {
        return
      }
      // creep.task = this.workerTaskFor(creep)
      this.runWorker(creep)
    })
  }

  private runWorker(creep: MyCreep): void {
    if (creep.room.name !== this.roomName) {
      creep.task = CreepTask.Tasks.MoveToRoom.create(this.roomName, [])
      return
    }

    // TODO: CreepTaskへ移す
    switch (creep.memory.tempState) {
    case "harvesting": {
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
        creep.memory.tempState = "working"
        return
      }
      const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE)
      if (source == null) {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          creep.memory.tempState = "working"
        }
        return
      }
      if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source)
      }
      return
    }

    case "working": {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
        creep.memory.tempState = "harvesting"
        return
      }

      const controller = creep.room.controller
      if (controller == null) {
        return
      }
      if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller)
      }
      return
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = creep.memory.tempState
      return
    }
    }
  }

  private getMyCreeps(dependency: Dependency): Map<CreepRoles, MyCreep[]> {
    const creeps = dependency.getCreepsFor(this.processId)
    const creepsWithTask = dependency.registerTaskDrivenCreeps<CreepRoles, CreepMemoryExtension>(creeps)

    const creepsByRole = new ValuedArrayMap<CreepRoles, MyCreep>()
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
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, { t: null, r: "worker", tempState: "harvesting" })
    dependency.addSpawnRequest(new CreepBody(body), this.parentRoomName, { codename: this.codename, memory })
  }

  private spawnClaimer(dependency: Dependency): void {
    const sign = ((): string => {
      if (dependency.botInfo == null) {
        return ""
      }
      return `[${dependency.botInfo.identifier}] ${dependency.botInfo.name} ${dependency.botInfo.version}`
    })()

    const tasks: CreepTask.AnyTask[] = [
      CreepTask.Tasks.MoveToRoom.create(this.roomName, []),
      CreepTask.Tasks.TargetRoomObject.create(this.roomName, {
        taskType: "ClaimController",
        sign,
      }),
    ]
    const claimerTask = CreepTask.Tasks.Sequential.create(tasks)
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, { t: claimerTask.encode(), r: "claimer", tempState: "working" })
    dependency.addSpawnRequest(new CreepBody([MOVE, CLAIM]), this.parentRoomName, { codename: this.codename, memory })
  }

  private destroyStructures(room: Room): void {
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES)
    hostileStructures.forEach(structure => structure.destroy())

    const walls = room.find<StructureWall>(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } })
    walls.forEach(wall => wall.destroy())
  }
}

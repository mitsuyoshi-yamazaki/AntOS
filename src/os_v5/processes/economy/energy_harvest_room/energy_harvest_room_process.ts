// Energy Harvest Room
import { EnergyHarvestRoomResource, EnergyHarvestRoomResourceState } from "./room_resource"
import { } from "./room_layout_maker"
import { Command, runCommands } from "os_v5/standard_io/command"
import { EnergyHarvestRoomProcessCreep, EnergyHarvestRoomProcessCreepMemory, EnergyHarvestRoomProcessCreepMemoryExtension, EnergyHarvestRoomProcessCreepRoles, EnergyHarvestRoomProcessDependency } from "./types"

// Object Controller
import { PrimitiveWorkerCreepController } from "./object_controllers/primitive_worker_creep_controller"
import {} from "./object_controllers/room_builder"

// Import
import { BotSpecifier, Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "../../../process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepTask } from "../../game_object_management/creep/creep_task/creep_task"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import { BotTypes } from "os_v5/process/process_type_map"
import { DeferredTaskId } from "os_v5/system_calls/depended_system_calls/deferred_task"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"



/**
# EnergyHarvestRoomProcess
## 概要
- そのRoomのEnergyを採掘するだけの、Ownedなリモート部屋
- 問題が起きたらそのまま殺す
 */


type EnergyHarvestRoomProcessApi = {
  readonly roomResource: EnergyHarvestRoomResource | null,
}


type CreepMemoryExtension = EnergyHarvestRoomProcessCreepMemoryExtension
type CreepRoles = EnergyHarvestRoomProcessCreepRoles
type MyCreep = EnergyHarvestRoomProcessCreep
type MyCreepMemory = EnergyHarvestRoomProcessCreepMemory
type Dependency = EnergyHarvestRoomProcessDependency
type DeferredTaskType = "make layout"


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

  private roomResourceGenerationResult: "succeeded" | "failed" | null = null
  private readonly codename: string

  private readonly workerController = new PrimitiveWorkerCreepController()

  private constructor(
    public readonly processId: EnergyHarvestRoomProcessId,
    private readonly roomName: RoomName,
    private readonly parentRoomName: RoomName,
    private roomResourceState: EnergyHarvestRoomResourceState | null,
    private readonly queuingDeferredTasks: Map<DeferredTaskType, DeferredTaskId>,
    private readonly botProcessSpecifier: BotSpecifier | null,
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))

    if (this.botProcessSpecifier != null) {
      this.dependencies.processes.push(this.botProcessSpecifier)
    }
  }

  public encode(): EnergyHarvestRoomProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName,
      rr: this.roomResourceState,
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
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.resetLayoutCommand,
    ])
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

    // if (this.roomResource == null) {
    //   if (this.roomResourceGenerationResult !== "failed" && this.queuingDeferredTasks.get("make layout") == null) {

    //     const controller = room.controller
    //     const taskId = SystemCalls.deferredTaskManager.register<DeferredTaskType, EnergyHarvestRoomResource | null>(
    //       this.processId as AnyProcessId,
    //       "make layout",
    //       (): EnergyHarvestRoomResource => {
    //         return (new EnergyHarvestRoomLayoutMaker(controller)).makeLayout()
    //       },
    //       {
    //         priority: deferredTaskPriority.low,
    //       },
    //     )

    //     this.queuingDeferredTasks.set("make layout", taskId)
    //   }
    // }

    const workers = creepsByRole.get("worker")
    if (workers == null || workers.length <= 0) {
      this.spawnWorker(dependency)
    } else {
      // TODO: roomResourceがない状態のprimitive worker controller
      workers.forEach(creep => this.workerController.run(creep, this.roomName))
    }

    return {
      roomResource: null, // TODO:
    }

    // TODO: roomResourceの状態を保存 // 固定値なら固定で良い : それはroom configのような固定値？
  }

  // public didFinishDeferredTask(taskResult: DeferredTaskResult<DeferredTaskType, EnergyHarvestRoomResource>): void {
  //   switch (taskResult.result.case) {
  //   case "succeeded":
  //     this.roomResourceGenerationResult = "succeeded"
  //     this.queuingDeferredTasks.delete(taskResult.taskType)
  //     this.roomResource = taskResult.result.value
  //     this.destroyStructures(taskResult.result.value.room)  // ここで行うのは、roomResource が算出される際に残しておくべき Structure の判断も行う想定のため
  //     return
  //   case "failed":
  //     this.roomResourceGenerationResult = "failed"
  //     this.queuingDeferredTasks.delete(taskResult.taskType)
  //     return
  //   default: {
  //     // eslint-disable-next-line @typescript-eslint/no-unused-vars
  //     const _: never = taskResult.result
  //     return
  //   }
  //   }
  // }

  // Private
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
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, { t: null, r: "worker" })
    dependency.addSpawnRequest<CreepMemoryExtension>(CreepBody.createWithBodyParts(body), this.parentRoomName, { codename: this.codename, memory })
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
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, { t: claimerTask.encode(), r: "claimer" })
    dependency.addSpawnRequest(CreepBody.createWithBodyParts([MOVE, CLAIM]), this.parentRoomName, { codename: this.codename, memory })
  }

  private destroyStructures(room: Room): void {
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES)
    hostileStructures.forEach(structure => structure.destroy())

    const walls = room.find<StructureWall>(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } })
    walls.forEach(wall => wall.destroy())
  }


  // ---- Command Runner ---- //
  private readonly resetLayoutCommand: Command = {
    command: "reset_layout",
    help: (): string => "reset_layout {room name}",

    /** @throws */
    run: (): string => {
      // const deletedObjects: string[] = []
      // if (this.roomResource != null) {
      //   deletedObjects.push("room resource")
      //   this.roomResource = null
      // }
      // if (this.roomResourceStateCache != null) {
      //   deletedObjects.push("room resource state cache")
      //   this.roomResourceStateCache = null
      // }

      // if (deletedObjects.length <= 0) {
      //   return "Nothing to reset"
      // }

      // return `Reset ${deletedObjects.join(" & ")}`
      throw "TODO:"
    }
  }
}

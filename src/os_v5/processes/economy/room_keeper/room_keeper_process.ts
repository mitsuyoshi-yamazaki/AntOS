import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ProcessSpecifier, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { CreepTask } from "os_v5/processes/game_object_management/creep/creep_task/creep_task"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { AnyTaskDrivenCreep, CreepTaskObserver, CreepTaskStateManagementProcessApi, TaskDrivenCreep } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import { Timestamp } from "shared/utility/timestamp"
import { RoomKeeperDelegate, RoomKeeperProblem } from "./delegate"
import { CreepTaskError, CreepTaskResult } from "os_v5/processes/game_object_management/creep/creep_task_result"
import { processTypeDecodingMap, processTypeEncodingMap, SerializedProcessTypes } from "os_v5/process/process_type_map"
import { CreepProviderApi } from "../../bot/creep_provider_api"
import { isMyRoom, MyRoom } from "shared/utility/room"
import { GameConstants } from "utility/constants"


/**
# RoomKeeperProcess
## 概要

## 仕様
### Creep
- 仕様は n x WORK,CARRY,MOVE,MOVE
 */

/**
 * Creep操作と部屋の状態監視は別でもいい
   * 別でも良いが、インターフェースとしては一緒の方が常に状態を把握できて都合が良い（delegate越しに通知しない状態の変化も内部的には見れるため）ので一緒にしておく
   * 内部的には別れても良い
 * 一般的なイベントは部屋の共有メモリを作ってそこに追加していく
 */


type WorkerSpec = {
  readonly count: number
  readonly maxSize: number
}


type Dependency = RoomKeeperDelegate
  & CreepProviderApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi


type RoomKeeperProcessState = {
  readonly l: Timestamp /// Launch time
  readonly r: RoomName  /// Room Name
  readonly p: SerializedProcessTypes  /// Serialized parent process type
  readonly pi: string                 /// Parent identifier
  readonly w: WorkerSpec
}

ProcessDecoder.register("RoomKeeperProcess", (processId: RoomKeeperProcessId, state: RoomKeeperProcessState) => RoomKeeperProcess.decode(processId, state))

export type RoomKeeperProcessId = ProcessId<Dependency, RoomName, void, RoomKeeperProcessState, RoomKeeperProcess>


export class RoomKeeperProcess extends Process<Dependency, RoomName, void, RoomKeeperProcessState, RoomKeeperProcess> implements CreepTaskObserver {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: RoomKeeperProcessId,
    public readonly launchTime: Timestamp,
    public readonly roomName: RoomName,
    private readonly parentProcessSpecifier: ProcessSpecifier,
    private readonly workerSpec: WorkerSpec,
  ) {
    super()

    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("RoomKeeperProcess", parseInt(processId, 36))
    this.dependencies.processes.push(parentProcessSpecifier)
  }

  public encode(): RoomKeeperProcessState {
    return {
      l: this.launchTime,
      r: this.roomName,
      p: processTypeEncodingMap[this.parentProcessSpecifier.processType],
      pi: this.parentProcessSpecifier.identifier,
      w: this.workerSpec,
    }
  }

  public static decode(processId: RoomKeeperProcessId, state: RoomKeeperProcessState): RoomKeeperProcess {
    const parent: ProcessSpecifier = {
      processType: processTypeDecodingMap[state.p],
      identifier: state.pi,
    }
    return new RoomKeeperProcess(processId, state.l, state.r, parent, state.w)
  }

  public static create(processId: RoomKeeperProcessId, roomName: RoomName, parentProcessSpecifier: ProcessSpecifier, workerCount: number, workerSize: number): RoomKeeperProcess {
    const workerSpec: WorkerSpec = {
      count: workerCount,
      maxSize: workerSize,
    }
    return new RoomKeeperProcess(processId, Game.time, roomName, parentProcessSpecifier, workerSpec)
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    const descriptions: string[] = [
      ConsoleUtility.roomLink(this.roomName),
    ]

    return descriptions.join(", ")
  }

  public runtimeDescription(dependency: Dependency): string {
    const descriptions: string[] = [
      this.staticDescription(),
      ((): string => {
        const { spawned, spawning } = dependency.getSpawnedCreepsFor(this.processId)
        const creeps = [...spawned, ...spawning]

        if (creeps.length <= 0) {
          return "no creeps"
        }
        if (creeps.length === 1 && creeps[0] != null) {
          return `creep in ${ConsoleUtility.roomLink(creeps[0].room.name)}`
        }
        return `${creeps.length} creeps`
      })(),
    ]

    return descriptions.join(", ")
  }

  public run(dependency: Dependency): void {
    const room = Game.rooms[this.roomName]
    if (room == null || !isMyRoom(room)) {
      return
    }

    const { spawned, spawning } = dependency.getSpawnedCreepsFor(this.processId)
    const creepsWithTasks = dependency.registerTaskDrivenCreeps<"", Record<string, never>>(spawned, { observer: { processId: this.processId, observer: this } })

    if ((spawned.length + spawning.length) < this.workerSpec.count) {
      // this.spawnWorker(dependency, room)  // 必要な時にリクエストを出し、受理されたら停止させる
    }

    creepsWithTasks.forEach(creep => {
      if (creep.task != null) {
        return
      }
      creep.task = this.workerTaskFor(creep)
    })
  }


  // ---- Private ---- //
  private workerTaskFor(creep: TaskDrivenCreep<"", Record<string, never>>): CreepTask.AnyTask | null {
    if (creep.room.name !== this.roomName) {
      return CreepTask.Tasks.MoveToRoom.create(this.roomName, [])
    }

    const source = creep.pos.findClosestByRange(FIND_SOURCES)
    if (source == null) {
      return null
    }
    const controller = creep.room.controller
    if (controller == null) {
      return null
    }

    const tasks: CreepTask.AnyTask[] = [
      CreepTask.Tasks.MoveTo.create(source.pos, GameConstants.creep.actionRange.harvest),
      CreepTask.Tasks.HarvestEnergy.create(source.id),
      CreepTask.Tasks.MoveTo.create(controller.pos, GameConstants.creep.actionRange.upgradeController),
      CreepTask.Tasks.UpgradeController.create(controller.id),
    ]
    return CreepTask.Tasks.Sequential.create(tasks)
  }

  private spawnWorker(dependency: Dependency, room: MyRoom): void {
    dependency.requestCreep({
      processId: this.processId,
      requestIdentifier: "worker",
      body: CreepBody.createWith([], [MOVE, CARRY, MOVE, MOVE], this.workerSpec.maxSize, room.energyCapacityAvailable),
      roomName: this.roomName,
      options: {
        codename: this.codename,
        memory: {},
      },
    })
  }


  // ---- Event Handler ---- //
  // CreepTaskObserver
  public creepTaskFinished(creep: AnyTaskDrivenCreep, result: CreepTaskResult): void {

  }

  public creepTaskFailed(creep: AnyTaskDrivenCreep, error: CreepTaskError): void {

  }

  private moveToRoomFailed(creep: AnyTaskDrivenCreep, error: CreepTask.Errors.MoveToRoomError): RoomKeeperProblem {
    switch (error) {
    case "no_exit":
    case ERR_NO_PATH:
      return {
        case: "room_unreachable",
        blockingRoomName: creep.room.name,
      }

    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_TIRED:
    case ERR_NO_BODYPART:
    case ERR_INVALID_TARGET:
    case ERR_NOT_FOUND:
    default:
      return {
        case: "unknown",
        reason: `MoveToRoom failed with ${error}`,
      }
    }
  }
}

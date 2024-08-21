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
import { ClaimRoomDelegate, ClaimRoomProblem, ClaimRoomProblemUnknown } from "./delegate"
import { CreepTaskError, CreepTaskResult } from "os_v5/processes/game_object_management/creep/creep_task_result"
import { processTypeDecodingMap, processTypeEncodingMap, SerializedProcessTypes } from "os_v5/process/process_type_map"
import { CreepProviderApi } from "../../bot/creep_provider_api"


type Dependency = ClaimRoomDelegate
  & CreepProviderApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi


type ClaimStateInitialized = {
  readonly case: "initialized"
}
type ClaimStateSpawnRequested = {
  readonly case: "spawn_requested"
}
type ClaimStateRunning = {
  readonly case: "running"
}
type ClaimStateFinished = {
  readonly case: "finished"
}
type ClaimStateFailed = {
  readonly case: "failed"
  readonly problem: ClaimRoomProblem
}
type ClaimState = ClaimStateInitialized | ClaimStateSpawnRequested | ClaimStateRunning | ClaimStateFinished | ClaimStateFailed

type ClaimRoomProcessState = {
  readonly l: Timestamp /// Launch time
  readonly r: RoomName  /// Room Name
  readonly p: SerializedProcessTypes  /// Serialized parent process type
  readonly pi: string                 /// Parent identifier
  readonly s: ClaimState
}

ProcessDecoder.register("ClaimRoomProcess", (processId: ClaimRoomProcessId, state: ClaimRoomProcessState) => ClaimRoomProcess.decode(processId, state))

export type ClaimRoomProcessId = ProcessId<Dependency, RoomName, void, ClaimRoomProcessState, ClaimRoomProcess>


export class ClaimRoomProcess extends Process<Dependency, RoomName, void, ClaimRoomProcessState, ClaimRoomProcess> implements CreepTaskObserver {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string
  private readonly estimatedFinishTime: Timestamp
  private onTickDependency: Dependency | null = null

  private constructor(
    public readonly processId: ClaimRoomProcessId,
    public readonly launchTime: Timestamp,
    public readonly roomName: RoomName,
    private readonly parentProcessSpecifier: ProcessSpecifier,
    private claimState: ClaimState,
  ) {
    super()

    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
    this.dependencies.processes.push(parentProcessSpecifier)
    this.estimatedFinishTime = this.launchTime + 1500 // TODO: 正確な見積もりを出す
  }

  public encode(): ClaimRoomProcessState {
    return {
      l: this.launchTime,
      r: this.roomName,
      p: processTypeEncodingMap[this.parentProcessSpecifier.processType],
      pi: this.parentProcessSpecifier.identifier,
      s: this.claimState,
    }
  }

  public static decode(processId: ClaimRoomProcessId, state: ClaimRoomProcessState): ClaimRoomProcess {
    const parent: ProcessSpecifier = {
      processType: processTypeDecodingMap[state.p],
      identifier: state.pi,
    }
    return new ClaimRoomProcess(processId, state.l, state.r, parent, state.s)
  }

  public static create(processId: ClaimRoomProcessId, roomName: RoomName, parentProcessSpecifier: ProcessSpecifier): ClaimRoomProcess {
    return new ClaimRoomProcess(processId, Game.time, roomName, parentProcessSpecifier, {case: "initialized"})
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return ConsoleUtility.roomLink(this.roomName)
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: Dependency): void {
    this.onTickDependency = dependency

    const { spawned } = dependency.getSpawnedCreepsFor(this.processId)
    const creepsWithTasks = dependency.registerTaskDrivenCreeps<"", Record<string, never>>(spawned, { observer: { processId: this.processId, observer: this } })

    if (this.claimState.case === "running") {
      creepsWithTasks.forEach(creep => {
        if (creep.task != null) {
          return
        }
        creep.task = this.claimerTaskFor(creep)
      })
    }

    this.transitionStates(dependency)
  }


  // ---- Private ---- //
  private transitionStates(dependency: Dependency): void {
    switch (this.claimState.case) {
    case "initialized":
      this.spawnClaimer(dependency)
      this.changeClaimState(dependency, {
        // case: "spawn_requested", // TODO: Spawn通知が出るようになったら状態を追加する
        case: "running",
      })
      return

    case "spawn_requested":
    case "running": {
      if (Game.time < this.estimatedFinishTime) {
        return
      }
      const problem: ClaimRoomProblemUnknown = {
        case: "unknown",
        reason: `haven't finished in ${Game.time - this.launchTime} ticks, state: ${this.claimState.case}`,
      }
      this.changeClaimState(dependency, {
        case: "failed",
        problem,
      })
      return
    }

    case "finished":
    case "failed":
      return

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.claimState
      break
    }
    }
  }

  private changeClaimState(dependency: Dependency, newState: ClaimState): void {
    this.claimState = newState

    switch (newState.case) {
    case "initialized":
    case "spawn_requested":
    case "running":
      break
    case "finished":
      dependency.claimRoomDidFinishClaiming(this)
      break
    case "failed":
      dependency.claimRoomDidFailClaiming(this, newState.problem)
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = newState
      break
    }
    }
  }

  private claimerTaskFor(creep: TaskDrivenCreep<"", Record<string, never>>): CreepTask.AnyTask {
    if (creep.room.name !== this.roomName) {
      return CreepTask.Tasks.MoveToRoom.create(this.roomName, [])
    }

    const sign = "M"

    const tasks: CreepTask.AnyTask[] = [
      CreepTask.Tasks.MoveToRoom.create(this.roomName, []),
      CreepTask.Tasks.TargetRoomObject.create(this.roomName, {
        taskType: "ClaimController",
        sign,
      }),
    ]
    return CreepTask.Tasks.Sequential.create(tasks)
  }

  private spawnClaimer(dependency: Dependency): void { // TODO: 呼び出し
    dependency.requestCreep({
      processId: this.processId,
      requestIdentifier: "claimer",
      body: CreepBody.createWithBodyParts([MOVE, CLAIM]),
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
    if (this.claimState.case !== "running") {
      return
    }

    if (result.taskType !== "ClaimController") {
      return
    }
    if (this.onTickDependency != null) {
      this.changeClaimState(this.onTickDependency, {
        case: "finished",
      })
    }
  }

  public creepTaskFailed(creep: AnyTaskDrivenCreep, error: CreepTaskError): void {
    if (this.claimState.case !== "running") {
      return
    }

    const problem = this.claimRoomProblemOf(creep, error)
    if (problem == null) {
      return
    }
    if (this.onTickDependency != null) {
      this.changeClaimState(this.onTickDependency, {
        case: "failed",
        problem,
      })
    }
  }

  private claimRoomProblemOf(creep: AnyTaskDrivenCreep, error: CreepTaskError): ClaimRoomProblem | null {
    switch (error.taskType) {
    case "MoveToRoom":
      return this.moveToRoomFailed(creep, error.error)
    case "TargetRoomObject":
      return this.targetRoomObjectFailed(creep, error.error)
    case "ClaimController":
      return this.claimControllerFailed(creep, error.error)
    default:
      return null
    }
  }

  private moveToRoomFailed(creep: AnyTaskDrivenCreep, error: CreepTask.Errors.MoveToRoomError): ClaimRoomProblem {
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

  private targetRoomObjectFailed(creep: AnyTaskDrivenCreep, error: CreepTask.Errors.TargetRoomObjectError): ClaimRoomProblem {
    switch (error) {
    case "no_target":
    case "not_in_the_room":
    case "unexpected_task_type":
      return {
        case: "unknown",
        reason: `TargetRoomObject failed with ${error}`,
      }
    }
  }

  private claimControllerFailed(creep: AnyTaskDrivenCreep, error: CreepTask.Errors.ClaimControllerError): ClaimRoomProblem {
    switch (error) {
    case "no_controller":
      return {
        case: "claim_failed",
        reason: "no_controller",
      }

    case ERR_NO_BODYPART:
      return {
        case: "creep_attacked",
      }

    case ERR_FULL: //You cannot claim more than 3 rooms in the Novice Area.
    case ERR_GCL_NOT_ENOUGH:
      return {
        case: "claim_failed",
        reason: "max",
      }

    case ERR_INVALID_TARGET:
      return {
        case: "claim_failed",
        reason: "not_neutral",
      }

    case ERR_TIRED:
    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_NOT_IN_RANGE:
    default:
      return {
        case: "unknown",
        reason: `ClaimController failed with ${error}`,
      }
    }
  }
}

import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { ProblemResolverProcessApi } from "@private/os_v5/processes/application/problem_resolver/types"
import { CreepTask } from "os_v5/processes/game_object_management/creep/creep_task/creep_task"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { AnyTaskDrivenCreep, CreepTaskObserver, CreepTaskStateManagementProcessApi, TaskDrivenCreep } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import { Timestamp } from "shared/utility/timestamp"



type Dependency = ProblemResolverProcessApi
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
  readonly taskType: CreepTask.TaskTypes
  readonly error: string | number
}
type ClaimState = ClaimStateInitialized | ClaimStateSpawnRequested | ClaimStateRunning | ClaimStateFinished | ClaimStateFailed

type ClaimRoomProcessState = {
  readonly l: Timestamp /// Launch time
  readonly r: RoomName  /// Room Name
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

  private constructor(
    public readonly processId: ClaimRoomProcessId,
    public readonly launchTime: Timestamp,
    public readonly roomName: RoomName,
    private claimState: ClaimState,
  ) {
    super()

    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
    this.dependencies.processes.push({ processType: "ProblemResolverProcess", identifier: this.roomName })
    this.estimatedFinishTime = this.launchTime + 1500 // TODO: 正確な見積もりを出す
  }

  public encode(): ClaimRoomProcessState {
    return {
      l: this.launchTime,
      r: this.roomName,
      s: this.claimState,
    }
  }

  public static decode(processId: ClaimRoomProcessId, state: ClaimRoomProcessState): ClaimRoomProcess {
    return new ClaimRoomProcess(processId, state.l, state.r, state.s)
  }

  public static create(processId: ClaimRoomProcessId, roomName: RoomName): ClaimRoomProcess {
    return new ClaimRoomProcess(processId, Game.time, roomName, {case: "initialized"})
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
    const { spawned } = dependency.getSpawnedCreepsFor(this.processId)
    const creepsWithTasks = dependency.registerTaskDrivenCreeps<"", Record<string, never>>(spawned, { observer: { processId: this.processId, observer: this } })

    creepsWithTasks.forEach(creep => {
      if (creep.task != null) {
        return
      }
      creep.task = this.claimerTaskFor(creep)
    })

    switch (this.claimState.case) {
    case "initialized":
      this.spawnClaimer(dependency)
      this.claimState = {
        case: "spawn_requested",
      }
      return

    case "spawn_requested":
    case "running":
      if (Game.time >= this.estimatedFinishTime) {
        return
      }
      break

    case "finished":
    case "failed":
    // TODO: Problem Resolverが受け付けられる、アクションに対する問題解決がある
      // この場合はClaim失敗と到達の失敗
      break

    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.claimState
      break
    }
    }
  }


  // ---- Event Handler ---- //
  // CreepTaskObserver
  public creepTaskFinished(creep: AnyTaskDrivenCreep, task: CreepTask.TaskTypes, result: unknown): void {
    this.claimState = {
      case: "finished",
    }
  }

  public creepTaskFailed(creep: AnyTaskDrivenCreep, task: CreepTask.TaskTypes, error: unknown): void {

  }


  // ---- Private ---- //
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
}

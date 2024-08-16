import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { ProblemResolverProcessApi } from "@private/os_v5/processes/application/problem_resolver/types"
import { CreepTask } from "os_v5/processes/game_object_management/creep/creep_task/creep_task"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { CreepTaskStateManagementProcessApi, TaskDrivenCreep } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"

// TODO: 完了見込みの算出
// TODO: （主に移動経路で）問題発生時のエラー処理

type Dependency = ProblemResolverProcessApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi

type ClaimRoomProcessState = {
  readonly r: RoomName  /// Room Name
}

ProcessDecoder.register("ClaimRoomProcess", (processId: ClaimRoomProcessId, state: ClaimRoomProcessState) => ClaimRoomProcess.decode(processId, state))

export type ClaimRoomProcessId = ProcessId<Dependency, RoomName, void, ClaimRoomProcessState, ClaimRoomProcess>


export class ClaimRoomProcess extends Process<Dependency, RoomName, void, ClaimRoomProcessState, ClaimRoomProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }

  private readonly codename: string

  private constructor(
    public readonly processId: ClaimRoomProcessId,
    public readonly roomName: RoomName,
  ) {
    super()

    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("V3BridgeSpawnRequestProcess", parseInt(processId, 36))
    this.dependencies.processes.push({ processType: "ProblemResolverProcess", identifier: this.roomName})
  }

  public encode(): ClaimRoomProcessState {
    return {
      r: this.roomName,
    }
  }

  public static decode(processId: ClaimRoomProcessId, state: ClaimRoomProcessState): ClaimRoomProcess {
    return new ClaimRoomProcess(processId, state.r)
  }

  public static create(processId: ClaimRoomProcessId, roomName: RoomName): ClaimRoomProcess {
    return new ClaimRoomProcess(processId, roomName)
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
    const creepsWithTasks = dependency.registerTaskDrivenCreeps<"", Record<string, never>>(spawned)

    creepsWithTasks.forEach(creep => {
      if (creep.task != null) {
        return
      }
      creep.task = this.claimerTaskFor(creep)
    })

    // TODO: creep taskの失敗を通知できるようにする：task側にフラグを持たせる
  }

  // Private
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

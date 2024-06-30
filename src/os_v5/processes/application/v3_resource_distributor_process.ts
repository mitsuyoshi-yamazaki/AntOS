import { processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ApplicationProcess } from "os_v5/process/application_process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { SemanticVersion } from "shared/utility/semantic_version"
import { Command, runCommands } from "os_v5/standard_io/command"
import { V3BridgeDriverProcessApi } from "../v3_os_bridge/v3_bridge_driver_process"
import { deferredTaskPriority, DeferredTaskResult } from "os_v5/system_calls/depended_system_calls/deferred_task"
import { SystemCalls } from "os_v5/system_calls/interface"


type Dependency = V3BridgeDriverProcessApi

type DeferredTaskTypes = "check_v3_rooms"
type DeferredTaskResultV3Room = {
  readonly case: "check_v3_rooms"
  readonly room: Room
  readonly state: string
}

type RoomTaskTrashUnnecessaryResources = {
  readonly case: "trash_unnecessary_resources"
}
type RoomTask = RoomTaskTrashUnnecessaryResources


type V3ResourceDistributorProcessState = {
  readonly r: { [RoomName: string]: RoomTask[] }
}

ProcessDecoder.register("V3ResourceDistributorProcess", (processId: V3ResourceDistributorProcessId, state: V3ResourceDistributorProcessState) => V3ResourceDistributorProcess.decode(processId, state))

export type V3ResourceDistributorProcessId = ProcessId<Dependency, ProcessDefaultIdentifier, void, V3ResourceDistributorProcessState, V3ResourceDistributorProcess>


export class V3ResourceDistributorProcess extends ApplicationProcess<Dependency, ProcessDefaultIdentifier, void, V3ResourceDistributorProcessState, V3ResourceDistributorProcess> {
  public readonly identifier = processDefaultIdentifier
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeDriverProcess", identifier: processDefaultIdentifier },
    ],
  }
  public readonly applicationName = "v3 ResourceDistributor"
  public readonly version = new SemanticVersion(1, 0, 2)


  private constructor(
    public readonly processId: V3ResourceDistributorProcessId,
    public readonly roomTasks: { [RoomName: string]: RoomTask[] },
  ) {
    super()
  }

  public encode(): V3ResourceDistributorProcessState {
    return {
      r: this.roomTasks,
    }
  }

  public static decode(processId: V3ResourceDistributorProcessId, state: V3ResourceDistributorProcessState): V3ResourceDistributorProcess {
    return new V3ResourceDistributorProcess(processId, state.r)
  }

  public static create(processId: V3ResourceDistributorProcessId): V3ResourceDistributorProcess {
    return new V3ResourceDistributorProcess(processId, {})
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }

  public staticDescription(): string {
    return `managing ${Array.from(Object.keys(this.roomTasks)).length} rooms`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.checkV3RoomsCommand,
    ])
  }

  public run(): void {
  }


  // ---- Deferred Task ---- //
  public didFinishDeferredTask<TaskType extends string, T>(taskResult: DeferredTaskResult<TaskType, T>): void {
    switch (taskResult.result.case) {
    case "succeeded":
      SystemCalls.logger.log(this, `Deferred task ${taskResult.taskType} finished`, true)
      break

    case "failed":
      SystemCalls.logger.log(this, `Deferred task ${taskResult.taskType} failed`, true)
      break
    }
  }


  // ---- Command Runner ---- //
  private readonly checkV3RoomsCommand: Command = {
    command: "check_v3_rooms",
    help: (): string => "check_v3_rooms",

    /** @throws */
    run: (): string => {
      const taskId = SystemCalls.deferredTaskManager.register<DeferredTaskTypes, DeferredTaskResultV3Room[]>(
        this.processId,
        "check_v3_rooms",
        (): DeferredTaskResultV3Room[] => {
          const dependency = SystemCalls.processManager.getDependencyFor<Dependency, ProcessDefaultIdentifier, void, V3ResourceDistributorProcessState, V3ResourceDistributorProcess>(this)
          if (dependency == null) {
            throw "Cannot get dependency"
          }
          // const ownedRoomResources = dependency.getOwnedRoomResources()
          // TODO:

          return []
        },
        { priority: deferredTaskPriority.anytime },
      )

      return `Registered a deferred task ${taskId}`
    }
  }
}

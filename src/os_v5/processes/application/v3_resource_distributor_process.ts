import { AnyProcessId, processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ApplicationProcess } from "os_v5/process/application_process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { SemanticVersion } from "shared/utility/semantic_version"
import { Command, runCommands } from "os_v5/standard_io/command"
import { V3BridgeDriverProcessApi } from "../v3_os_bridge/v3_bridge_driver_process"
import { deferredTaskPriority, DeferredTaskResult } from "os_v5/system_calls/depended_system_calls/deferred_task"
import { SystemCalls } from "os_v5/system_calls/interface"
import { TrashResourceProcess, TrashResourceProcessId } from "../economy/single_task_processes/trash_resource_process"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"


type Dependency = V3BridgeDriverProcessApi

type DeferredTaskTypes = "check_v3_rooms"
type DeferredTaskResultV3Room = {
  readonly case: "check_v3_rooms"
  readonly room: Room
  readonly state: string
}


type RoomProcessIds = { [RoomName: string]: AnyProcessId[] }
type V3ResourceDistributorProcessState = {
  readonly r: RoomProcessIds
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
  public readonly version = new SemanticVersion(1, 0, 3)


  private constructor(
    public readonly processId: V3ResourceDistributorProcessId,
    public readonly roomProcessIds: RoomProcessIds,
  ) {
    super()
  }

  public encode(): V3ResourceDistributorProcessState {
    return {
      r: this.roomProcessIds,
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
    return `managing ${Array.from(Object.keys(this.roomProcessIds)).length} rooms`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  /** @throws */
  public didReceiveMessage(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      this.checkV3RoomsCommand,
      this.addProcessCommand,
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

          throw "Not implemented yet"
        },
        { priority: deferredTaskPriority.anytime },
      )

      return `Registered a deferred task ${taskId}`
    }
  }

  private readonly addProcessCommand: Command = {
    command: "add_process",
    help: (): string => "add_process",

    /** @throws */
    run: (argumentParser: ArgumentParser): string => {
      const myRoom = argumentParser.myRoom("room_name").parse()
      const roomName = myRoom.name

      const process = SystemCalls.processManager.addProcess((newProcessId: TrashResourceProcessId) => {
        return TrashResourceProcess.create(newProcessId, myRoom, myRoom)
      })

      if (this.roomProcessIds[roomName] == null) {
        this.roomProcessIds[roomName] = [process.processId]
      } else {
        this.roomProcessIds[roomName]?.push(process.processId)
      }

      return `Added ${process} to ${ConsoleUtility.roomLink(roomName)}`
    }
  }
}

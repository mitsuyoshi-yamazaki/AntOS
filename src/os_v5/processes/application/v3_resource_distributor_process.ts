import { AnyProcessId, processDefaultIdentifier, ProcessDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ApplicationProcess } from "os_v5/process/application_process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { SemanticVersion } from "shared/utility/semantic_version"
import { Command, runCommands } from "os_v5/standard_io/command"
import { V3BridgeDriverProcessApi } from "../v3_os_bridge/v3_bridge_driver_process"
import { deferredTaskPriority, DeferredTaskResult } from "os_v5/system_calls/depended_system_calls/deferred_task"
import { SystemCalls } from "os_v5/system_calls/interface"
import { DisposeResourceProcess, DisposeResourceProcessId } from "../economy/single_task_processes/dispose_resource_process"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { RoomName } from "shared/utility/room_name_types"


type Dependency = V3BridgeDriverProcessApi

type RoomDescription = {
  readonly roomName: RoomName
  readonly processIds: AnyProcessId[]
  readonly warnings: string[]
}

type DeferredTaskTypes = "check_v3_rooms"
type DeferredTaskResultV3Room = {
  readonly case: "check_v3_rooms"
  readonly roomDescriptions: RoomDescription[]
}
type DeferredTaskResults = DeferredTaskResultV3Room


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
  public readonly version = new SemanticVersion(1, 0, 7)


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
  public didFinishDeferredTask(taskResult: DeferredTaskResult<DeferredTaskTypes, DeferredTaskResults>): void {
    switch (taskResult.result.case) {
    case "succeeded":
      switch (taskResult.result.value.case) {
      case "check_v3_rooms": {
        const roomDescription = taskResult.result.value.roomDescriptions.map(formatRoomDescription).join("\n")
        SystemCalls.logger.log(this, `Deferred task ${taskResult.taskType} finished:\n${roomDescription}`, true)
        break
      }
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = taskResult.result.value.case
        break
      }
      }
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
      const taskId = SystemCalls.deferredTaskManager.register<DeferredTaskTypes, DeferredTaskResults>(
        this.processId,
        "check_v3_rooms",
        (): DeferredTaskResults => {
          const dependency = SystemCalls.processManager.getDependencyFor<Dependency, ProcessDefaultIdentifier, void, V3ResourceDistributorProcessState, V3ResourceDistributorProcess>(this)
          if (dependency == null) {
            throw "Cannot get dependency"
          }

          const roomDescriptions: RoomDescription[] = []
          const ownedRoomResources = dependency.getOwnedRoomResources()

          ownedRoomResources.forEach(roomResource => {
            const stores: (StructureStorage | StructureTerminal)[] = []
            if (roomResource.activeStructures.storage != null) {
              stores.push(roomResource.activeStructures.storage)
            }
            if (roomResource.activeStructures.terminal != null) {
              stores.push(roomResource.activeStructures.terminal)
            }

            const processIds = this.roomProcessIds[roomResource.room.name] ?? []
            const warnings = getStorageWarnings(stores)
            if (warnings.length <= 0 && processIds.length <= 0) {
              return
            }

            roomDescriptions.push({
              roomName: roomResource.room.name,
              processIds,
              warnings,
            })
          })

          return {
            case: "check_v3_rooms",
            roomDescriptions,
          }
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

      const process = SystemCalls.processManager.addProcess((newProcessId: DisposeResourceProcessId) => {
        return DisposeResourceProcess.create(newProcessId, myRoom, myRoom)
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


const getStorageWarnings = (stores: (StructureStorage | StructureTerminal)[]): string[] => {
  const warnings: string[] = []

  let totalCapacity = 0
  let freeCapacity = 0
  stores.forEach(store => {
    totalCapacity += store.store.getCapacity()
    freeCapacity += store.store.getFreeCapacity()
  })
  const usedCapacity = totalCapacity - freeCapacity

  if (freeCapacity < 40000) {
    warnings.push(`Usage warning: ${Math.floor((usedCapacity / totalCapacity) * 100)}% (${ConsoleUtility.shortenedNumber(usedCapacity)}/${ConsoleUtility.shortenedNumber(totalCapacity)})`)
  }

  const energyAmount = stores.reduce((result, current) => result + current.store.getUsedCapacity(RESOURCE_ENERGY), 0)
  if (energyAmount < 50000) {
    warnings.push(`Energy warning: ${ConsoleUtility.shortenedNumber(energyAmount)} ${ConsoleUtility.coloredResourceType(RESOURCE_ENERGY)}`)
  }

  return warnings
}

const formatRoomDescription = (description: RoomDescription): string => {
  const descriptions: string[] = [
    `- ${ConsoleUtility.roomLink(description.roomName)}:`,
  ]

  if (description.processIds.length > 0) {
    descriptions.push(`  - Processes: ${description.processIds.join(", ")}`)
  }

  if (description.warnings.length > 0) {
    descriptions.push("  - warnings:")
    descriptions.push(...description.warnings.map(warning => `    - ${warning}`))
  }

  return descriptions.join("\n")
}

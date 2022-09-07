import { Process, ProcessExecutionOrder, ProcessExecutionPriority, ProcessExecutionSpec, ProcessId, ProcessState } from "../process"
import { ProcessType, ProcessTypeConverter } from "../process_type"
import { Application } from "../application/application_process"
import { LaunchMessageObserver } from "../message_observer/launch_message_observer"
import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"
import { OwnedRoomProcessRequest } from "../owned_room_process/owned_room_process_request"
import type { RoomName } from "shared/utility/room_name_types"
import { SemanticVersion } from "shared/utility/semantic_version"
import { PrimitiveLogger } from "v8/operating_system/primitive_logger"

const processType = "EconomyProcess"

export interface EconomyProcessState extends ProcessState {
}

export class EconomyProcess extends Process implements LaunchMessageObserver, Application {
  public readonly applicationName: string = processType
  public readonly version = new SemanticVersion(1, 0, 0)

  public readonly processType = processType

  // private ownedRoomProcesses: OwnedRoomProcess[] = []

  private constructor(
  ) {
    super()
    PrimitiveLogger.info(`${this.applicationName} ${this.version}`)
  }

  public encode(): EconomyProcessState {
    return {
      t: ProcessTypeConverter.convert(this.processType),
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public static decode(state: EconomyProcessState): EconomyProcess {
    return new EconomyProcess()
  }

  public decodeChildProcess(processType: ProcessType, state: ProcessState): Process | null {
    switch (processType) {
    // case "OwnedRoomProcess":
    //   return OwnedRoomProcess.decode(state as OwnedRoomProcessState)
    default:
      return null
    }
  }

  public static create(): EconomyProcess {
    return new EconomyProcess()
  }

  public shortDescription = (): string => {
    return `${this.version}`
  }

  /** @throws */
  public didReceiveLaunchMessage(processType: ProcessType, args: ArgumentParser): Process {
    switch (processType) {
    // case "OwnedRoomProcess": {
    //   const roomResource = args.list.ownedRoomResource(0, "room name").parse()
    //   const process = OwnedRoomProcess.create(roomResource)
    //   this.ownedRoomProcesses.push(process)
    //   return process
    // }
    default:
      throw `${this.constructor.name} doesn't launch ${processType}`
    }
  }

  public executionSpec(): ProcessExecutionSpec {
    return {
      executionPriority: ProcessExecutionPriority.high - 1,
      executionOrder: ProcessExecutionOrder.normal,
      interval: 1,
    }
  }

  public load(processId: ProcessId): void {
    // this.ownedRoomProcesses = []
    // ProcessManager.getChildProcesses(processId).forEach(childProcess => {
    //   if (childProcess instanceof OwnedRoomProcess) {
    //     this.ownedRoomProcesses.push(childProcess)
    //     return
    //   }
    // })
  }

  public run = (): void => {
    // TODO: 部屋ごとの優先順位をつける（攻撃、防御、拡張、upgrade

    const ownedRoomRequests = this.runOwnedRoomProcess()
    // TODO: request処理
  }

  private runOwnedRoomProcess(): Map<RoomName, OwnedRoomProcessRequest> {
    const requests = new Map<RoomName, OwnedRoomProcessRequest>()

    // this.ownedRoomProcesses.forEach(ownedRoomProcess => {
    //   ownedRoomProcess.run = (processId: ProcessId): void => {
    //     const request: OwnedRoomProcessRequest = {}
    //     requests.set(ownedRoomProcess.roomName, request)
    //     ownedRoomProcess.runWith(processId, request)
    //   }
    // })

    return requests
  }
}

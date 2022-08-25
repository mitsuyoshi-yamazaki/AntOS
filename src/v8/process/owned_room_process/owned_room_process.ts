import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomResources } from "room_resource/room_resources"
import { roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { ProcessManager } from "v8/operating_system/process_manager"
import { LaunchMessageObserver } from "../message_observer/launch_message_observer"
import { Process, ProcessId, ProcessState } from "../process"
import { ProcessType, ProcessTypeConverter } from "../process_type"
import { OwnedRoomChildProcess } from "./owned_room_child_process"
import { OwnedRoomTestProcess } from "./owned_room_test_process"

const processType = "OwnedRoomProcess"

export interface OwnedRoomProcessState extends ProcessState {
  /// room name
  readonly r: RoomName
}

export class OwnedRoomProcess extends Process implements LaunchMessageObserver {
  public readonly processType = processType

  private childProcesses: OwnedRoomChildProcess[] = []

  private constructor(
    public readonly roomName: RoomName,
  ) {
    super()
  }

  public encode(): OwnedRoomProcessState {
    return {
      t: ProcessTypeConverter.convert(this.processType),
      r: this.roomName,
    }
  }

  public static decode(state: OwnedRoomProcessState): OwnedRoomProcess {
    return new OwnedRoomProcess(
      state.r,
    )
  }

  public decodeChildProcess(processType: ProcessType, state: ProcessState): Process | null {
    switch (processType) {
    case "OwnedRoomTestProcess":
      return OwnedRoomTestProcess.decode(state, this.roomName)
    default:
      return null
    }
  }

  public static create(roomResource: OwnedRoomResource): OwnedRoomProcess {
    return new OwnedRoomProcess(
      roomResource.room.name,
    )
  }

  public shortDescription = (): string => {
    return roomLink(this.roomName)
  }

  /** @throws */
  public didReceiveLaunchMessage(processType: ProcessType): Process {
    switch (processType) {
    case "OwnedRoomTestProcess": {
      const process = OwnedRoomTestProcess.create(this.roomName)
      this.childProcesses.push(process)
      return process
    }
    default:
      throw `${this.constructor.name} doesn't launch ${processType}`
    }
  }

  public load(processId: ProcessId): void {
    this.childProcesses = []
    ProcessManager.getChildProcesses(processId).forEach(childProcess => {
      if (childProcess instanceof OwnedRoomChildProcess) {
        this.childProcesses.push(childProcess)
      }
    })
  }

  public run = (processId: ProcessId): void => {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)

    if (roomResource == null) {
      PrimitiveLogger.fatal(`${processId} ${roomLink(this.roomName)} is lost`)
      return
    }

    this.childProcesses.forEach(childProcess => {
      childProcess.run = () => {
        childProcess.runWith(roomResource)
      }
    })
  }
}

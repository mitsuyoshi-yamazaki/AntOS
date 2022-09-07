import { ProcessManager } from "v8/operating_system/process_manager"
import { LaunchMessageObserver } from "../message_observer/launch_message_observer"
import { Process, ProcessExecutionOrder, ProcessExecutionPriority, ProcessExecutionSpec, ProcessId, ProcessState } from "../process"
import { ProcessType, ProcessTypeConverter } from "../process_type"
import { OwnedRoomChildProcess } from "./owned_room_child_process"
import { OwnedRoomTestProcess } from "./owned_room_test_process"
import { OwnedRoomResource } from "../../operating_system/driver/beryllium/owned_room_resource/owned_room_resource"
import { OwnedRoomProcessRequest } from "./owned_room_process_request"
import { ProcessLogger } from "v8/operating_system/system_call/process_logger"
import type { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

const roomLink = ConsoleUtility.roomLink

const processType = "OwnedRoomProcess"

type OwnedRoomStateLost = {
  readonly case: "lost"
}
type OwnedRoomStateNormal = {
  readonly case: "noraml"
}
type OwnedRoomStateUnclaiming = {
  readonly case: "unclaiming"
}
type OwnedRoomState = OwnedRoomStateLost | OwnedRoomStateNormal | OwnedRoomStateUnclaiming

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

  public executionSpec(): ProcessExecutionSpec {
    return {
      executionPriority: ProcessExecutionPriority.top,
      executionOrder: ProcessExecutionOrder.normal,
      interval: 1,
    }
  }

  public load(processId: ProcessId): void {
    this.childProcesses = []
    ProcessManager.getChildProcesses(processId).forEach(childProcess => {
      if (childProcess instanceof OwnedRoomChildProcess) {
        this.childProcesses.push(childProcess)
        return
      }
    })
  }

  public runWith(processId: ProcessId, requests: OwnedRoomProcessRequest): void {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      ProcessLogger.error(this, `${roomLink(this.roomName)} is lost`)
      return  // TODO: unclaim等
    }

    const roomResource = new OwnedRoomResource(room)

    if (roomResource == null) {
      return
    }

    this.childProcesses.forEach(childProcess => {
      childProcess.run = () => {
        childProcess.runWith(roomResource)
      }
    })
  }
}

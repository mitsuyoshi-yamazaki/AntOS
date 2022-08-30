import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { RoomName } from "shared/utility/room_name"
import { ProcessExecutionOrder, ProcessExecutionPriority, ProcessExecutionSpec, ProcessState } from "../process"
import { ProcessTypeConverter } from "../process_type"
import { OwnedRoomChildProcess } from "./owned_room_child_process"
import { OwnedRoomResource } from "./owned_room_resource/owned_room_resource"

const processType = "OwnedRoomTestProcess"

export interface OwnedRoomTestProcessState extends ProcessState {
}

export class OwnedRoomTestProcess extends OwnedRoomChildProcess {
  public readonly processType = processType

  private constructor(
    public readonly roomName: RoomName,
  ) {
    super()
  }

  public encode(): OwnedRoomTestProcessState {
    return {
      t: ProcessTypeConverter.convert(this.processType),
    }
  }

  public static decode(state: OwnedRoomTestProcessState, roomName: RoomName): OwnedRoomTestProcess {
    return new OwnedRoomTestProcess(
      roomName,
    )
  }

  public static create(roomName: RoomName): OwnedRoomTestProcess {
    return new OwnedRoomTestProcess(
      roomName,
    )
  }

  public shortDescription = (): string => {
    return roomLink(this.roomName)
  }

  public executionSpec(): ProcessExecutionSpec {
    return {
      executionPriority: ProcessExecutionPriority.medium,
      executionOrder: ProcessExecutionOrder.normal,
      interval: 1,
    }
  }

  public run = (): void => {
    PrimitiveLogger.programError(`${this.processId} ${this.constructor.name}.run() is not replaced`)
  }

  public runWith(roomResource: OwnedRoomResource): void {
    if ((Game.time % 10) === 0) {
      PrimitiveLogger.log(`${this.constructor.name} ${this.processId} ${roomLink(roomResource.room.name)}`)
    }
  }
}

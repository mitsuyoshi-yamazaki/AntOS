import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { ScoutRoomTask, ScoutRoomTaskState } from "task/scout/scout_room_task"
import { ProcessState } from "process/process_state"

export interface OnetimeTaskProcessState extends ProcessState {
  /** room name */
  r: RoomName

  // /** task state */
  // s: ScoutRoomTaskState
}

export class OnetimeTaskProcess implements Process, Procedural {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    // private readonly task: ScoutRoomTask,
  ) { }

  public encode(): OnetimeTaskProcessState {
    return {
      t: "OnetimeTaskProcess",
      l: this.launchTime,
      i: this.processId,
      r: this.roomName,
      // s: this.task.encode(),
    }
  }

  public static decode(state: OnetimeTaskProcessState): OnetimeTaskProcess {
    // const task = ScoutRoomTask.decode(state.s)
    return new OnetimeTaskProcess(state.l, state.i, state.r)
  }

  public static create(processId: ProcessId, roomName: RoomName): OnetimeTaskProcess {
    return new OnetimeTaskProcess(Game.time, processId, roomName)
  }

  public processShortDescription(): string {
    return roomLink(this.roomName)
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.roomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.roomName)} lost`)
      return
    }
    // this.task.run(objects)

    const a = ScoutRoomTask.create(this.roomName, "W0S0", [])
    a.run(objects)
  }
}

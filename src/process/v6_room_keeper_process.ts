import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "./process_state"
import { RoomKeeperTask, RoomKeeperTaskState } from "application/room_keeper/room_keeper_task"
import { decodeTasksFrom } from "application/task_decoder"

export interface V6RoomKeeperProcessState extends ProcessState {
  /** task state */
  s: RoomKeeperTaskState
}

export class V6RoomKeeperProcess implements Process, Procedural {
  public get roomName(): RoomName {
    return this.task.roomName
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly task: RoomKeeperTask,
  ) { }

  public encode(): V6RoomKeeperProcessState {
    return {
      t: "V6RoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.task.encode(),
    }
  }

  public static decode(state: V6RoomKeeperProcessState): V6RoomKeeperProcess {
    const task = RoomKeeperTask.decode(state.s, decodeTasksFrom(state.s.c))
    return new V6RoomKeeperProcess(state.l, state.i, task)
  }

  public static create(processId: ProcessId, task: RoomKeeperTask): V6RoomKeeperProcess {
    return new V6RoomKeeperProcess(Game.time, processId, task)
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
    this.task.run(objects)
  }
}

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId, ProcessState } from "process/process"
import { RoomName } from "utility/room_name"
import { RoomKeeperTask, RoomKeeperTaskState } from "task/room_keeper/room_keeper_task"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"

export interface RoomKeeperProcessState extends ProcessState {
  /** task state */
  s: RoomKeeperTaskState
}

export class RoomKeeperProcess implements Process, Procedural {
  public get roomName(): RoomName {
    return this.task.roomName
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly task: RoomKeeperTask,
  ) { }

  public encode(): RoomKeeperProcessState {
    return {
      t: "RoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.task.encode(),
    }
  }

  public static decode(state: RoomKeeperProcessState): RoomKeeperProcess {
    const task = RoomKeeperTask.decode(state.s)
    return new RoomKeeperProcess(state.l, state.i, task)
  }

  public static create(processId: ProcessId, task: RoomKeeperTask): RoomKeeperProcess {
    return new RoomKeeperProcess(Game.time, processId, task)
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

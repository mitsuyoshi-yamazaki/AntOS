import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { RoomKeeperTask, RoomKeeperTaskState } from "v5_task/room_keeper/room_keeper_task"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { decodeTasksFrom } from "v5_task/task_decoder"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"

ProcessDecoder.register("RoomKeeperProcess", state => {
  return RoomKeeperProcess.decode(state as RoomKeeperProcessState)
})

export interface RoomKeeperProcessState extends ProcessState {
  /** task state */
  s: RoomKeeperTaskState
}

export class RoomKeeperProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  public get roomName(): RoomName {
    return this.task.roomName
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly task: RoomKeeperTask,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): RoomKeeperProcessState {
    return {
      t: "RoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.task.encode(),
    }
  }

  public static decode(state: RoomKeeperProcessState): RoomKeeperProcess {
    const task = RoomKeeperTask.decode(state.s, decodeTasksFrom(state.s.c))
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

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "./process_state"
import { RoomKeeperTask, RoomKeeperTaskState } from "application/room_keeper/room_keeper_task"
import { RoomResources } from "room_resource/room_resources"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { TaskRequests } from "application/task_requests"
import { TaskLogRequest } from "application/task_logger"
import { processLog } from "./process_log"

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
    const task = RoomKeeperTask.decode(state.s)
    return new V6RoomKeeperProcess(state.l, state.i, task)
  }

  public static create(processId: ProcessId, task: RoomKeeperTask): V6RoomKeeperProcess {
    return new V6RoomKeeperProcess(Game.time, processId, task)
  }

  public processShortDescription(): string {
    return roomLink(this.roomName)
  }

  public runOnTick(): void {
    const ownedRoomResource = RoomResources.getRoomResource(this.roomName)
    if (!(ownedRoomResource instanceof OwnedRoomResource)) {
      PrimitiveLogger.fatal(`${roomLink(this.roomName)} lost`)
      return
    }
    const unresolvedRequests = this.task.runTask(ownedRoomResource)
    this.handleUnresolvedRequests(unresolvedRequests)
  }

  private handleUnresolvedRequests(taskRequests: TaskRequests<void>): void {
    if (taskRequests.creepTaskAssignRequests.length > 0) {
      PrimitiveLogger.fatal(`[Program bug] Unexpectedly found unresolved creep task assign request ${this.task.identifier} at ${roomLink(this.roomName)}`)
    }
    if (taskRequests.spawnRequests.length > 0) {
      PrimitiveLogger.fatal(`[Program bug] Unexpectedly found unresolved spawn request ${this.task.identifier} at ${roomLink(this.roomName)}`)
    }
    if (taskRequests.towerRequests.length > 0) {
      PrimitiveLogger.fatal(`[Program bug] Unexpectedly found unresolved tower request ${this.task.identifier} at ${roomLink(this.roomName)}`)
    }

    this.log(taskRequests.logs)
    // taskRequests.problems.forEach(problem => {
    //   PrimitiveLogger.fatal(`Unresolved problem ${problem.identifier}, ${this.task.identifier} at ${roomLink(this.roomName)}`)
    // })
  }

  private log(logs: TaskLogRequest[]): void {
    const messages: string[] = logs.map(log => `${log.taskIdentifier} ${log.logEventType}: ${log.message}`) // TODO: みやすくフォーマットする
    processLog(this, messages.join("\n"))
  }
}

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "./process_state"
import { RoomKeeperTask, RoomKeeperTaskOutputs, RoomKeeperTaskState } from "application/task/room_keeper/room_keeper_task"
import { RoomResources } from "room_resource/room_resources"
import { TaskLogRequest } from "application/task_logger"
import { processLog } from "os/infrastructure/logger"
import { MessageObserver } from "os/infrastructure/message_observer"
import { bodyDescription } from "utility/creep_body"

type LogFilter = {
  spawn: boolean
}

export interface V6RoomKeeperProcessState extends ProcessState {
  /** task state */
  s: RoomKeeperTaskState

  readonly logFilter: LogFilter
}

export class V6RoomKeeperProcess implements Process, Procedural, MessageObserver {
  public get roomName(): RoomName {
    return this.task.roomName
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly task: RoomKeeperTask,
    private readonly logFilter: LogFilter,
  ) { }

  public encode(): V6RoomKeeperProcessState {
    return {
      t: "V6RoomKeeperProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.task.encode(),
      logFilter: this.logFilter,
    }
  }

  public static decode(state: V6RoomKeeperProcessState): V6RoomKeeperProcess {
    const task = RoomKeeperTask.decode(state.s)
    return new V6RoomKeeperProcess(state.l, state.i, task, state.logFilter)
  }

  public static create(processId: ProcessId, task: RoomKeeperTask): V6RoomKeeperProcess {
    return new V6RoomKeeperProcess(Game.time, processId, task, {spawn: false})
  }

  public processShortDescription(): string {
    return roomLink(this.roomName)
  }

  public runOnTick(): void {
    const ownedRoomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (ownedRoomResource == null) {
      PrimitiveLogger.fatal(`${roomLink(this.roomName)} lost`)
      return
    }
    const unresolvedRequests = this.task.runSafely(ownedRoomResource)
    this.handleUnresolvedRequests(unresolvedRequests)
  }

  private handleUnresolvedRequests(taskRequests: RoomKeeperTaskOutputs): void {
    if (taskRequests.creepTaskAssignRequests.size > 0) {
      PrimitiveLogger.programError(`Unexpectedly found unresolved creep task assign request ${this.task.identifier} at ${roomLink(this.roomName)}`)
    }
    if (taskRequests.towerRequests.length > 0) {
      PrimitiveLogger.programError(`Unexpectedly found unresolved tower request ${this.task.identifier} at ${roomLink(this.roomName)}`)
    }

    const logRequests = [...taskRequests.logs]
    if (this.logFilter.spawn === true) {
      const spawnLogs: TaskLogRequest[] = taskRequests.spawnRequests.map(request => ({
        taskIdentifier: request.taskIdentifier,
        logEventType: "event",
        message: `[Spawn reques] type: ${request.spawnTaskRequestType}, body: ${bodyDescription(request.body)}, priority: ${request.priority}`,
      }))
      logRequests.push(...spawnLogs)
    }

    this.log(logRequests)
    taskRequests.problems.forEach(problem => {
      PrimitiveLogger.fatal(`Unresolved problem ${problem.identifier}, ${this.task.identifier} at ${roomLink(this.roomName)}`)
    })
  }

  private log(logs: TaskLogRequest[]): void {
    if (logs.length <= 0) {
      return
    }
    const messages: string[] = logs.map(log => `${log.taskIdentifier} ${log.logEventType}: ${log.message}`) // TODO: みやすくフォーマットする
    processLog(this, messages.join("\n"))
  }

  public didReceiveMessage(message: string): string {
    const argumentMap = new Map<string, string>()
    message.split(" ").forEach(arg => {
      const [key, value] = arg.split("=")
      if (key == null || value == null) {
        return
      }
      argumentMap.set(key, value)
    })

    const spawn = argumentMap.get("spawn")
    if (spawn != null) {
      this.logFilter.spawn = spawn === "1"
      return `Set log filter => spawn: ${this.logFilter.spawn}`
    }

    return "Nothing to do"
  }
}

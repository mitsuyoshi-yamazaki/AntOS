import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { decodeTasksFrom } from "task/task_decoder"
import { ProcessState } from "./process_state"
import { MessageObserver } from "os/infrastructure/message_observer"
import { Migration } from "utility/migration"
import { ShortVersion } from "utility/system_info"
import { BootstrapRoomTask, BootstrapRoomTaskState } from "task/bootstrap_room/bootstrap_room_task"
import { processLog } from "./process_log"

export interface BootstrapRoomManagerProcessState extends ProcessState {
  /** task state */
  s: BootstrapRoomTaskState[]
}

// Game.io("message 34351666000 parent_room_name=W52S28 target_room_name=W52S25 waypoints=W51S28,W51S26")
export class BootstrapRoomManagerProcess implements Process, Procedural, MessageObserver {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly tasks: BootstrapRoomTask[],
  ) { }

  public encode(): BootstrapRoomManagerProcessState {
    return {
      t: "BootstrapRoomManagerProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.tasks.map(task => task.encode()),
    }
  }

  public static decode(state: BootstrapRoomManagerProcessState): BootstrapRoomManagerProcess {
    const tasks = state.s.map(taskState => BootstrapRoomTask.decode(taskState, decodeTasksFrom(taskState.c)))
    return new BootstrapRoomManagerProcess(state.l, state.i, tasks)
  }

  public static create(processId: ProcessId): BootstrapRoomManagerProcess {
    return new BootstrapRoomManagerProcess(Game.time, processId, [])
  }

  public processShortDescription(): string {
    return this.tasks.map(task => roomLink(task.targetRoomName)).join(",")
  }

  public runOnTick(): void {
    const failedTasks: BootstrapRoomTask[] = []
    const finishedTasks: BootstrapRoomTask[] = []

    this.tasks.forEach(task => {
      const objects = World.rooms.getOwnedRoomObjects(task.parentRoomName)
      if (objects == null) {
        PrimitiveLogger.fatal(`${roomLink(task.parentRoomName)} lost`)
        return
      }
      const result = task.run(objects)
      switch (result) {
      case "in progress":
        return
      case "failed":
        failedTasks.push(task)
        return
      case "finished":
        finishedTasks.push(task)
        return
      }
    })

    finishedTasks.forEach(task => {
      processLog(this, `${task.taskIdentifier} finished`)
      this.removeTask(task)
    })
    failedTasks.forEach(task => {
      processLog(this, `${task.taskIdentifier} failed`)
      this.removeTask(task)
    })
  }

  public didReceiveMessage(message: string): string {
    const args = new Map<string, string>()
    for (const keyValue of message.split(" ")) {
      const values = keyValue.split("=")
      if (values.length !== 2) {
        return `Invalid argument ${keyValue}`
      }
      args.set(values[0], values[1])
    }

    const missingArgumentError = (argumentName: string): string => `Missing argument ${argumentName}`

    const parentRoomName = args.get("parent_room_name")
    if (parentRoomName == null) {
      return missingArgumentError("parent_room_name")
    }
    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return missingArgumentError("target_room_name")
    }
    const rawWaypoints = args.get("waypoints")
    if (rawWaypoints == null) {
      return missingArgumentError("waypoints")
    }
    const waypoints = rawWaypoints.split(",")

    if (Migration.roomVersion(parentRoomName) === ShortVersion.v3) {
      return `v3 room ${roomLink(parentRoomName)} is not supported`
    }

    const targetRoom = World.rooms.get(targetRoomName)
    if (targetRoom != null && targetRoom.controller != null && targetRoom.controller.my === true) {
      return `${roomLink(targetRoomName)} is already mine`
    }
    const bootstrappingRoomNames = this.tasks.map(task => task.targetRoomName)
    if (bootstrappingRoomNames.includes(targetRoomName) === true) {
      return `BootstrapRoomTask to ${roomLink(targetRoomName)} already launched`
    }

    this.tasks.push(BootstrapRoomTask.create(parentRoomName, targetRoomName, waypoints))
    return `Launched BootstrapRoomTask ${roomLink(targetRoomName)} (parent: ${roomLink(parentRoomName)})`
  }

  // ---- Task ---- //
  private removeTask(task: BootstrapRoomTask): void {
    const index = this.tasks.indexOf(task)
    if (index < 0) {
      PrimitiveLogger.fatal(`Failed to remove task ${task.taskIdentifier}`)
      return
    }
    this.tasks.splice(index, 1)
  }
}

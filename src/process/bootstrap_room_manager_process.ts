import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { decodeTasksFrom } from "v5_task/task_decoder"
import { ProcessState } from "./process_state"
import { MessageObserver } from "os/infrastructure/message_observer"
import { Migration } from "utility/migration"
import { ShortVersion } from "utility/system_info"
import { BootstrapRoomTask, BootstrapRoomTaskState } from "v5_task/bootstrap_room/bootstrap_room_task"
import { processLog } from "./process_log"

export interface BootstrapRoomManagerProcessState extends ProcessState {
  /** task state */
  s: BootstrapRoomTaskState[]

  /** next GCL */
  g: number | null
}

// Game.io("message 34351666000 parent_room_name=W52S28 target_room_name=W52S25 waypoints=W51S28,W51S26")
// Game.io("message 387872000 parent_room_name=W24S29 target_room_name=W14S28 waypoints=W23S29,W23S30,W14S30")
// Game.io("message 544054000 parent_room_name=W14S28 target_room_name=W9S24 waypoints=W14S30,W10S30")
// Game.io("message 544054000 parent_room_name=W9S24 target_room_name=W1S25 waypoints=W8S25")
// Game.io("message 544054000 parent_room_name=W1S25 target_room_name=E5S23 waypoints=E0S25,E0S24,E3S24,E3S23,E5S23 target_gcl=6")
// Game.io("message 544054000 parent_room_name=W1S25 target_room_name=W3S24 waypoints=W1S24,W2S24,W2S23 target_gcl=6")
export class BootstrapRoomManagerProcess implements Process, Procedural, MessageObserver {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly tasks: BootstrapRoomTask[],
    private nextGcl: number | null,
  ) { }

  public encode(): BootstrapRoomManagerProcessState {
    return {
      t: "BootstrapRoomManagerProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.tasks.map(task => task.encode()),
      g: this.nextGcl,
    }
  }

  public static decode(state: BootstrapRoomManagerProcessState): BootstrapRoomManagerProcess {
    const tasks = state.s.map(taskState => BootstrapRoomTask.decode(taskState, decodeTasksFrom(taskState.c)))
    return new BootstrapRoomManagerProcess(state.l, state.i, tasks, state.g)
  }

  public static create(processId: ProcessId): BootstrapRoomManagerProcess {
    return new BootstrapRoomManagerProcess(Game.time, processId, [], null)
  }

  public processShortDescription(): string {
    const nextLevelDescription = this.shouldRun() ? `${Math.floor(Game.gcl.progressTotal - Game.gcl.progress)}CP left` : ""
    return `${this.tasks.map(task => roomLink(task.targetRoomName)).join(",")} ${nextLevelDescription}`
  }

  public runOnTick(): void {
    if (this.shouldRun() !== true) {
      return
    }

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
      const [key, value] = keyValue.split("=")
      if (key == null || value == null) {
        return `Invalid argument ${keyValue}`
      }
      args.set(key, value)
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

    const targetGcl = args.get("target_gcl")
    if (targetGcl == null) {
      return missingArgumentError("target_gcl")
    }
    const parsedTargetGcl = parseInt(targetGcl, 10)
    if (isNaN(parsedTargetGcl) === true) {
      return `target_gcl is not a number (${targetGcl})`
    }

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
    this.nextGcl = parsedTargetGcl
    return `Launched BootstrapRoomTask ${roomLink(targetRoomName)} (parent: ${roomLink(parentRoomName)})`
  }

  // ---- Private ---- //
  private shouldRun(): boolean {
    if (this.nextGcl == null) {
      return false
    }
    if (this.nextGcl <= Game.gcl.level) {
      return true
    }
    if (this.nextGcl - 1 !== Game.gcl.level) {
      return false
    }
    const nextLevel = Game.gcl.progressTotal - Game.gcl.progress
    return nextLevel < 80000
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

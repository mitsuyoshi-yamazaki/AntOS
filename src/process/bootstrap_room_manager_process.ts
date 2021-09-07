import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { decodeTasksFrom } from "v5_task/task_decoder"
import { ProcessState } from "./process_state"
import { MessageObserver } from "os/infrastructure/message_observer"
import { BootstrapRoomTask, BootstrapRoomTaskState } from "v5_task/bootstrap_room/bootstrap_room_task"
import { processLog } from "os/infrastructure/logger"
import { isRoomName, RoomName } from "utility/room_name"
import { Result } from "utility/result"

export interface BootstrapRoomManagerProcessState extends ProcessState {
  /** task state */
  s: BootstrapRoomTaskState[]

  /** next GCL */
  g: number | null
}

// Game.io("message 34351858000 parent_room_name=W51S29 target_room_name=W45S31 waypoints=W51S30,W46S30 target_gcl=42 energy=10000")
export class BootstrapRoomManagerProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly tasks: BootstrapRoomTask[],
    private nextGcl: number | null,
  ) {
    this.taskIdentifier = this.constructor.name
  }

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
    return `${this.tasks.map(task => roomLink(task.targetRoomName)).join(",")}`
  }

  public claimingRoomCount(): number {
    return this.tasks.length
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
    if (message.startsWith("clear ") === true) {
      const roomName = message.slice(6)
      if (!isRoomName(roomName)) {
        return `${roomName} is not room name`
      }

      const childTask = this.tasks.find(task => task.targetRoomName === roomName)
      if (childTask == null) {
        return `${roomLink(roomName)} is not bootstrapping`
      }
      this.removeTask(childTask)
      return `Removed boostrap task for ${roomLink(roomName)}`
    }

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
    const claimInfo = ((): { parentRoomName: RoomName, waypoints: RoomName[] } | string => {
      const claimParentRoomName = args.get("claim_parent_room_name")
      if (claimParentRoomName == null) {
        return {
          parentRoomName,
          waypoints: [...waypoints],
        }
      }
      const rawClaimWaypoints = args.get("claim_waypoints")
      if (rawClaimWaypoints == null) {
        return missingArgumentError("claim_waypoints")
      }
      const claimWaypoints = rawClaimWaypoints.split(",") ?? []
      return {
        parentRoomName: claimParentRoomName,
        waypoints: claimWaypoints,
      }
    })()
    if (typeof claimInfo === "string") {
      return claimInfo
    }

    const targetGcl = args.get("target_gcl")
    if (targetGcl == null) {
      return missingArgumentError("target_gcl")
    }
    const parsedTargetGcl = parseInt(targetGcl, 10)
    if (isNaN(parsedTargetGcl) === true) {
      return `target_gcl is not a number (${targetGcl})`
    }

    const requiredEnergy = ((): number | null => {
      const rawEnergy = args.get("energy")
      if (rawEnergy == null) {
        return 0
      }
      const energy = parseInt(rawEnergy, 10)
      if (isNaN(energy) === true) {
        return null
      }
      return energy
    })()
    if (requiredEnergy == null) {
      return `Invalid energy ${args.get("energy")} is not a number`
    }

    const ignoreSpawn = args.get("ignore_spawn") === "1"

    const result = this.addBootstrapRoom(parentRoomName, targetRoomName, waypoints, claimInfo, parsedTargetGcl, requiredEnergy, ignoreSpawn)
    switch (result.resultType) {
    case "succeeded":
      return result.value
    case "failed":
      return result.reason
    }
  }

  public addBootstrapRoom(parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], claimInfo: { parentRoomName: RoomName, waypoints: RoomName[] }, targetGcl: number | null, requiredEnergy: number, ignoreSpawn: boolean): Result<string, string> {
    const targetRoom = World.rooms.get(targetRoomName)
    if (targetRoom != null && targetRoom.controller != null && targetRoom.controller.my === true && targetRoom.controller.level >= 3) {
      if (ignoreSpawn !== true) {
        const spawn = targetRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })
        if (spawn.length > 0) {
          return Result.Failed(`${roomLink(targetRoomName)} is already mine`)
        }
      }
    }
    const bootstrappingRoomNames = this.tasks.map(task => task.targetRoomName)
    if (bootstrappingRoomNames.includes(targetRoomName) === true) {
      return Result.Failed(`BootstrapRoomTask to ${roomLink(targetRoomName)} already launched`)
    }

    this.tasks.push(BootstrapRoomTask.create(parentRoomName, targetRoomName, waypoints, claimInfo.parentRoomName, claimInfo.waypoints, requiredEnergy))
    this.nextGcl = targetGcl

    const parentInfo = ((): string => {
      if (parentRoomName === claimInfo.parentRoomName) {
        return roomLink(parentRoomName)
      }
      return `${roomLink(parentRoomName)}, claim: ${roomLink(claimInfo.parentRoomName)}`
    })()
    return Result.Succeeded(`Launched BootstrapRoomTask ${roomLink(targetRoomName)} (parent: ${parentInfo})`)
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

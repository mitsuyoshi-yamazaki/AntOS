import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { decodeTasksFrom } from "v5_task/task_decoder"
import { ProcessState } from "../process_state"
import { MessageObserver } from "os/infrastructure/message_observer"
import { BootstrapRoomTask, BootstrapRoomTaskState } from "v5_task/bootstrap_room/bootstrap_room_task"
import { processLog } from "os/infrastructure/logger"
import { isRoomName, RoomName } from "utility/room_name"
import { Result } from "utility/result"
import { ProcessDecoder } from "../process_decoder"
import { RoomResources } from "room_resource/room_resources"

type TargetRoom = {
  readonly parentRoomName: RoomName
  readonly targetRoomName: RoomName
  readonly waypoints: RoomName[]
  readonly claimInfo: {
    readonly parentRoomName: RoomName
    readonly waypoints: RoomName[]
  }
  readonly requiredEnergy: number
  readonly ignoreSpawn: boolean
}

ProcessDecoder.register("BootstrapRoomManagerProcess", state => {
  return BootstrapRoomManagerProcess.decode(state as BootstrapRoomManagerProcessState)
})

export interface BootstrapRoomManagerProcessState extends ProcessState {
  /** task state */
  s: BootstrapRoomTaskState[]

  readonly queuedTargets: TargetRoom[]
}

export class BootstrapRoomManagerProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly tasks: BootstrapRoomTask[],
    private readonly queuedTargets: TargetRoom[]
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): BootstrapRoomManagerProcessState {
    return {
      t: "BootstrapRoomManagerProcess",
      l: this.launchTime,
      i: this.processId,
      s: this.tasks.map(task => task.encode()),
      queuedTargets: this.queuedTargets,
    }
  }

  public static decode(state: BootstrapRoomManagerProcessState): BootstrapRoomManagerProcess {
    const tasks = state.s.map(taskState => BootstrapRoomTask.decode(taskState, decodeTasksFrom(taskState.c)))
    return new BootstrapRoomManagerProcess(state.l, state.i, tasks, state.queuedTargets ?? [])
  }

  public static create(processId: ProcessId): BootstrapRoomManagerProcess {
    return new BootstrapRoomManagerProcess(Game.time, processId, [], [])
  }

  public processShortDescription(): string {
    const descriptions: string[] = []
    if (this.tasks.length > 0) {
      descriptions.push(`${this.tasks.map(task => roomLink(task.targetRoomName)).join(",")}`)
    }
    if (this.queuedTargets.length > 0) {
      descriptions.push(`queued: ${this.queuedTargets.map(target => roomLink(target.targetRoomName)).join(",")}`)
    }
    return descriptions.join(", ")
  }

  public claimingRoomCount(): number {
    return this.tasks.length
  }

  public runOnTick(): void {
    if (this.queuedTargets.length > 0 && this.canAddTarget() === true) {
      const queuedTarget = this.queuedTargets.shift()
      if (queuedTarget != null) {
        const result = this.addBootstrapRoom(
          queuedTarget.parentRoomName,
          queuedTarget.targetRoomName,
          queuedTarget.waypoints,
          queuedTarget.claimInfo,
          queuedTarget.requiredEnergy,
          queuedTarget.ignoreSpawn
        )
        switch (result.resultType) {
        case "succeeded":
          processLog(this, result.value)
          break
        case "failed":
          processLog(this, result.reason)
          break
        }
      }
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
    this.addTargetRoomQueue(
      parentRoomName,
      targetRoomName,
      waypoints,
      claimInfo,
      requiredEnergy,
      ignoreSpawn,
    )
    return "target queued"
  }

  public addTargetRoomQueue(parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], claimInfo: { parentRoomName: RoomName, waypoints: RoomName[] }, requiredEnergy: number, ignoreSpawn: boolean): void {
    this.queuedTargets.push({
      parentRoomName,
      targetRoomName,
      waypoints,
      claimInfo,
      requiredEnergy,
      ignoreSpawn,
    })
  }

  private addBootstrapRoom(parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], claimInfo: { parentRoomName: RoomName, waypoints: RoomName[] }, requiredEnergy: number, ignoreSpawn: boolean): Result<string, string> {
    const targetRoom = World.rooms.get(targetRoomName)  // TODO: キューする際にもチェックする
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

    const parentInfo = ((): string => {
      if (parentRoomName === claimInfo.parentRoomName) {
        return roomLink(parentRoomName)
      }
      return `${roomLink(parentRoomName)}, claim: ${roomLink(claimInfo.parentRoomName)}`
    })()
    return Result.Succeeded(`Launched BootstrapRoomTask ${roomLink(targetRoomName)} (parent: ${parentInfo})`)
  }

  // ---- Private ---- //
  private canAddTarget(): boolean {
    const targetingRoomCount = ((): number => {
      const ownedRoomNames = RoomResources.getOwnedRoomResources().map(resource => resource.room.name)
      this.tasks.forEach(task => {
        if (ownedRoomNames.includes(task.targetRoomName) !== true) {
          ownedRoomNames.push(task.targetRoomName)
        }
      })
      return ownedRoomNames.length
    })()

    const availableRoomCount = RoomResources.getClaimableRoomCount()

    if (availableRoomCount > targetingRoomCount) {
      return true
    }
    if (availableRoomCount === targetingRoomCount) {
      const nextLevel = Game.gcl.progressTotal - Game.gcl.progress
      return nextLevel < 80000  // TODO: 算出する
    }
    return false
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

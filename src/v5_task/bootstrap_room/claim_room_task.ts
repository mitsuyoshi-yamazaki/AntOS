import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName } from "utility/room_name"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "v5_task/general/general_creep_worker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { MoveClaimControllerTask } from "v5_object_task/creep_task/combined_task/move_claim_controller_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"
import { RoomResources } from "room_resource/room_resources"
import { CreepBody } from "utility/creep_body"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { GameConstants } from "utility/constants"

function shouldSpawnBootstrapCreeps(roomName: RoomName, targetRoomName: RoomName): boolean {
  const targetRoomInfo = RoomResources.getRoomInfo(targetRoomName)
  if (targetRoomInfo == null) {
    return true
  }
  if (targetRoomInfo.roomType !== "normal") {
    return true
  }
  // if (targetRoomInfo.owner == null) {
  //   return true
  // }
  // if (targetRoomInfo.owner.ownerType === "claim" && targetRoomInfo.owner.username !== Game.user.name) {
  //   return false
  // }
  if (targetRoomInfo.owner?.ownerType === "claim") {
    if (targetRoomInfo.owner.upgradeBlockedUntil != null) {
      if (Game.time < (targetRoomInfo.owner.upgradeBlockedUntil - (GameConstants.creep.life.claimLifeTime * 0.8))) {
        return false
      }
    }
    if (targetRoomInfo.owner.safemodeEnabled === true) {
      return false
    }
  }
  const availableEnergy = ((): number => {
    const roomResource = RoomResources.getOwnedRoomResource(roomName)
    if (roomResource == null) {
      PrimitiveLogger.programError(`Bootstrap parent room ${roomLink(roomName)} is not owned`)
      return 0
    }
    const storage = roomResource.activeStructures.storage
    const terminal = roomResource.activeStructures.terminal
    if (storage == null || terminal == null) {
      PrimitiveLogger.programError(`Bootstrap parent room ${roomLink(roomName)} has no storage or terminal`)
      return 0
    }
    return (storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0) + (terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
  })()

  if (availableEnergy < 10000) {
    return false
  }
  return true
}

export interface ClaimRoomTaskState extends GeneralCreepWorkerTaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]
}

export class ClaimRoomTask extends GeneralCreepWorkerTask {
  public readonly taskIdentifier: TaskIdentifier

  private readonly codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[]
  ) {
    super(startTime, children, roomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)
  }

  public encode(): ClaimRoomTaskState {
    return {
      t: "ClaimRoomTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
      w: this.waypoints
    }
  }

  public static decode(state: ClaimRoomTaskState, children: Task[]): ClaimRoomTask {
    return new ClaimRoomTask(state.s, children, state.r, state.tr, state.w)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): ClaimRoomTask {
    return new ClaimRoomTask(Game.time, [], roomName, targetRoomName, [...waypoints])
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom != null && targetRoom.controller != null && targetRoom.controller.my === true) {
      return TaskStatus.Finished
    }

    super.runTask(objects, childTaskResults)

    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  public creepFileterRoles(): CreepRole[] | null {
    return [CreepRole.Claimer]
  }

  public creepRequest(): GeneralCreepWorkerTaskCreepRequest | null {
    if (shouldSpawnBootstrapCreeps(this.roomName, this.targetRoomName) !== true) {
      return null
    }

    const creepTask = MoveClaimControllerTask.create(this.targetRoomName, this.waypoints, true)
    const body = ((): BodyPartConstant[] => {
      const minimumBody = [MOVE, CLAIM]
      const defaultBody = [MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM]
      const resources = RoomResources.getOwnedRoomResource(this.roomName)
      if (resources == null) {
        return defaultBody
      }
      if (resources.getResourceAmount(RESOURCE_ENERGY) < 40000) {
        return defaultBody
      }

      const isOccupied = ((): boolean => {
        const targetRoom = Game.rooms[this.targetRoomName]
        if (targetRoom == null) {
          return false
        }
        const controller = targetRoom.controller
        if (controller == null) {
          return false
        }
        if (controller.reservation != null) {
          if (controller.reservation.username === Game.user.name) {
            return false
          }
          return true
        }
        if (controller.owner != null) {
          if (controller.my === true) {
            return false
          }
          return true
        }
        return true
      })()

      if (isOccupied === true) {
        const attackerBody = CreepBody.create([], [MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM], resources.room.energyCapacityAvailable, 10)
        if (attackerBody.length <= 0) {
          return minimumBody
        }

        attackerBody.sort((lhs, rhs) => {
          if (lhs === rhs) {
            return 0
          }
          return lhs === CLAIM ? 1 : -1
        })
        return attackerBody
      }

      if (CreepBody.cost(defaultBody) > resources.room.energyCapacityAvailable) {
        return minimumBody
      }
      return defaultBody
    })()

    return {
      necessaryRoles: [CreepRole.Claimer],
      taskIdentifier: this.taskIdentifier,
      numberOfCreeps: 1,
      codename: this.codename,
      initialTask: creepTask,
      priority: CreepSpawnRequestPriority.Medium,
      body,
    }
  }

  public newTaskFor(): CreepTask | null {
    return MoveClaimControllerTask.create(this.targetRoomName, this.waypoints, true)
  }
}

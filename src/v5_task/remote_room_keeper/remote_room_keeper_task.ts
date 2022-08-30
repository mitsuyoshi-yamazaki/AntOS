import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomInvisibleProblemFinder } from "v5_problem/remote_room/room_invisible_problem_finder"
import { RoomName } from "shared/utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "v5_task/task_state"
import { RemoteRoomWorkerTask } from "./remote_room_worker_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Environment } from "utility/environment"
import { RoomResources } from "room_resource/room_resources"
import { Invader } from "game/invader"

export interface RemoteRoomKeeperTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName
}

/**
 * - RemoteRoomManager
 *   - RemoteRoomKeeper(s)
 *     - RemoteRoomWorker
 *       - RemoteRoomReserver
 *       - RemoteRoomHarvester
 *       - RemoteRoomHauler
 */
export class RemoteRoomKeeperTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
  }

  public encode(): RemoteRoomKeeperTaskState {
    return {
      t: "RemoteRoomKeeperTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
    }
  }

  public static decode(state: RemoteRoomKeeperTaskState, children: Task[]): RemoteRoomKeeperTask {
    return new RemoteRoomKeeperTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName): RemoteRoomKeeperTask {
    const children: Task[] = [
    ]
    return new RemoteRoomKeeperTask(Game.time, children, roomName, targetRoomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    if (objects.controller.level < 3) {
      return TaskStatus.InProgress
    }

    const problemFinders: ProblemFinder[] = [
    ]

    const ownerNameWhitelist: string[] = [
      Invader.username,
      Game.user.name,
    ]
    const targetRoomInfo = RoomResources.getRoomInfo(this.targetRoomName)
    const shouldCheckInvisibility = ((): boolean => {
      if (targetRoomInfo == null) {
        return true
      }
      switch (targetRoomInfo.roomType) {
      case "owned":
        return false
      case "normal":
        break
      }
      if (targetRoomInfo.owner == null) {
        if ((Game.time % 97) < 29) {
          return true
        }
        return false
      }
      if (targetRoomInfo.owner.ownerType === "reserve" && ownerNameWhitelist.includes(targetRoomInfo.owner.username) === true) {
        return true
      }
      if (((Game.time + this.startTime) % 1511) < 40) {
        return true
      }
      return false
    })()
    if (shouldCheckInvisibility === true) {
      problemFinders.push(new RoomInvisibleProblemFinder(objects, this.targetRoomName))
    }

    this.checkProblemFinders(problemFinders)

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom != null && targetRoomInfo != null && targetRoomInfo.roomType === "normal") {
      const shouldLaunchRemoteRoomWorker = ((): boolean => {
        if (this.children.some(task => task instanceof RemoteRoomWorkerTask) === true) {
          return false
        }
        if (objects.activeStructures.storage == null) {
          return false
        }
        if (targetRoomInfo.owner != null) {
          if (targetRoomInfo.owner.ownerType === "claim") {
            return false
          }
          if (ownerNameWhitelist.includes(targetRoomInfo.owner.username) !== true) {
            return false
          }
        }
        if (targetRoom.find(FIND_HOSTILE_CREEPS).length > 0) {
          return false
        }
        return true
      })()
      if (shouldLaunchRemoteRoomWorker === true) {
        this.addChildTask(RemoteRoomWorkerTask.create(this.roomName, targetRoom))
      }
    }

    const workerToRemove = this.children.find(task => {
      if (!(task instanceof RemoteRoomWorkerTask)) {
        return false
      }
      if (Environment.world === "persistent world" && Environment.shard === "shard2" && task.roomName === "W39S38" && task.targetRoomName === "W39S39") {  // 起動中のRemoteRoomWorkerを削除したい場合: keeper taskを削除する場合はRemoteRoomManagerTaskで行う
        return true
      }
      return false
    })
    if (workerToRemove != null) {
      PrimitiveLogger.log(`${this.taskIdentifier} removed child task ${workerToRemove.taskIdentifier}`)
      this.removeChildTask(workerToRemove)
    }

    return TaskStatus.InProgress
  }
}

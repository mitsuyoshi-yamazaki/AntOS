import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomInvisibleProblemFinder } from "v5_problem/remote_room/room_invisible_problem_finder"
import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "v5_task/task_state"
import { RemoteRoomHarvesterTask } from "./remote_room_harvester_task"
import { RemoteRoomWorkerTask } from "./remote_room_worker_task"
import { remoteRoomNamesToDefend } from "process/onetime/season_487837_attack_invader_core_room_names"
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

// TODO: reserve
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
        return true
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

    // if (this.targetRoomName === "W25S29" && this.children.some(task => task instanceof RemoteRoomHarvesterTask) !== true) {
    //   const room = World.rooms.get(this.targetRoomName)
    //   if (room != null) {
    //     const sources = room.find(FIND_SOURCES)
    //     sources.forEach(source => {
    //       console.log(`RemoteRoomHarvesterTask added ${source}`)
    //       this.addChildTask(RemoteRoomHarvesterTask.create(this.roomName, source))
    //     })
    //   }
    // }
    const harvesterTask = this.children.find(task => task instanceof RemoteRoomHarvesterTask)
    if (harvesterTask != null) {
      this.removeChildTask(harvesterTask)
    }

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom != null && targetRoomInfo != null && targetRoomInfo.roomType === "normal") {
      const shouldLaunchRemoteRoomWorker = ((): boolean => {
        const resources = RoomResources.getOwnedRoomResource(this.roomName)
        const excludedRemotes = resources?.roomInfo.config?.excludedRemotes
        if (excludedRemotes != null && excludedRemotes.includes(this.targetRoomName) === true) {
          return false
        }
        if (this.children.some(task => task instanceof RemoteRoomWorkerTask) === true) {
          const remoteRoomNames = remoteRoomNamesToDefend.getValueFor(this.roomName)
          if (remoteRoomNames.includes(this.targetRoomName) !== true) {
            remoteRoomNames.push(this.targetRoomName)
          }
          return false
        }
        if (objects.activeStructures.storage == null) {
          return false
        }
        const remoteRooms = remoteRoomNamesToDefend.get(this.roomName)
        if (remoteRooms != null) {
          if (remoteRooms.includes(this.targetRoomName) === true) {
            return true
          }
        }
        if (Environment.world === "season 3") {
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
      if (Environment.world === "persistent world" && Environment.shard === "shard2" && task.roomName === "W52S28" && task.targetRoomName === "W52S29") {  // 起動中のRemoteRoomWorkerを削除したい場合
        return true
      }
      return false
    })
    if (workerToRemove != null) {
      PrimitiveLogger.log(`${this.taskIdentifier} removed child task ${workerToRemove.taskIdentifier}`)
      this.removeChildTask(workerToRemove)
    }

    // this.checkInvasion()

    return TaskStatus.InProgress
  }

  // private checkInvasion(): void {
  //   if (this.children.some(task => task instanceof RemoteRoomWorkerTask) !== true) {
  //     return
  //   }
  //   const targetRoom = Game.rooms[this.targetRoomName]
  //   if (targetRoom == null) {
  //     return
  //   }
  //   const invaderCreeps = targetRoom.find(FIND_HOSTILE_CREEPS)

  // }
}

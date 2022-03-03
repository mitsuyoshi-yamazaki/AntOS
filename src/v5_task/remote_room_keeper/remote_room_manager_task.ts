import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName, roomTypeOf } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { RemoteRoomKeeperTask } from "./remote_room_keeper_task"
import { TaskState } from "v5_task/task_state"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText } from "utility/log"
import { RoomResources } from "room_resource/room_resources"

export interface RemoteRoomManagerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

/**
 * - RemoteRoomManager
 *   - RemoteRoomDefender
 *   - RemoteRoomKeeper(s)
 *     - RemoteRoomWorker
 *       - RemoteRoomReserver
 *       - RemoteRoomHarvester
 *       - RemoteRoomHauler
 */
export class RemoteRoomManagerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): RemoteRoomManagerTaskState {
    return {
      t: "RemoteRoomManagerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: RemoteRoomManagerTaskState, children: Task[]): RemoteRoomManagerTask {
    return new RemoteRoomManagerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): RemoteRoomManagerTask {
    const children: Task[] = []
    const parentRoomStatus = Game.map.getRoomStatus(roomName)?.status // sim環境ではundefinedが返る
    const remoteRoomInfo = RoomResources.getOwnedRoomResource(roomName)?.roomInfo.remoteRoomInfo

    const harvestingRemoteRoomNames = RoomResources.getOwnedRoomResources().flatMap((resource): RoomName[] => {
      return [
        resource.room.name,
        ...Array.from(Object.keys(resource.roomInfoAccessor.roomInfo.remoteRoomInfo)),
      ]
    })

    const exits = Game.map.describeExits(roomName)
    if (exits != null) { // sim環境ではundefinedが返る
      Object.entries(exits).forEach(([, neighbour]) => {
        if (roomTypeOf(neighbour) !== "normal") {
          return
        }
        const roomStatus = Game.map.getRoomStatus(neighbour)
        if (roomStatus.status !== parentRoomStatus) {
          return
        }
        children.push(RemoteRoomKeeperTask.create(roomName, neighbour))

        const enabled = ((): boolean => {
          if (harvestingRemoteRoomNames.includes(neighbour) === true) {
            return false
          }
          const neighbourRoomInfo = RoomResources.getRoomInfo(neighbour)
          if (neighbourRoomInfo == null) {
            return true
          }
          if (neighbourRoomInfo.roomType === "owned") {
            return false
          }
          if (neighbourRoomInfo.owner?.ownerType === "claim") {
            return false
          }
          return true
        })()

        if (remoteRoomInfo != null) {
          remoteRoomInfo[neighbour] = {
            roomName: neighbour,
            enabled,
            routeCalculatedTimestamp: {},
            constructionFinished: false,
          }
        }
      })
    }

    return new RemoteRoomManagerTask(Game.time, children, roomName)
  }

  public runTask(): TaskStatus {
    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    // Migration
    this.launchRemoteRoom()

    return TaskStatus.InProgress
  }

  private launchRemoteRoom(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }
    const remoteRooms = Array.from(Object.entries(roomResource.roomInfo.remoteRoomInfo))
    remoteRooms.forEach(([remoteRoomName, remoteRoomInfo]) => {
      const keeperTask = this.keeperTask(remoteRoomName)
      if (keeperTask == null) {
        if (remoteRoomInfo.enabled === true) {
          this.addRoomKeeperTask(remoteRoomName)
        }
        return
      }

      if (remoteRoomInfo.enabled === false) {
        this.removeRoomKeeperTask(keeperTask)
      }
    })
  }

  private keeperTask(remoteRoomName: RoomName): RemoteRoomKeeperTask | null {
    return this.children.find(task => {
      if (!(task instanceof RemoteRoomKeeperTask)) {
        return false
      }
      if (task.roomName !== this.roomName || task.targetRoomName !== remoteRoomName) {
        return false
      }
      return true
    }) as RemoteRoomKeeperTask | null
  }

  private addRoomKeeperTask(targetRoomName: RoomName): void {
    this.addChildTask(RemoteRoomKeeperTask.create(this.roomName, targetRoomName))
    PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} remote room keeper task added ${this.roomName} &gt ${targetRoomName}`)
  }

  private removeRoomKeeperTask(keeperTask: RemoteRoomKeeperTask): void {
    this.removeChildTask(keeperTask)
    PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} remote room keeper task removed ${this.roomName} &gt ${keeperTask.targetRoomName}`)
  }
}

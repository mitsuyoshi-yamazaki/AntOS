import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "task/task_state"

export interface RemoteRoomCreateRoadConstructionSiteTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName
}

export class RemoteRoomCreateRoadConstructionSiteTask extends Task {
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

  public encode(): RemoteRoomCreateRoadConstructionSiteTaskState {
    return {
      t: "RemoteRoomCreateRoadConstructionSiteTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
    }
  }

  public static decode(state: RemoteRoomCreateRoadConstructionSiteTaskState, children: Task[]): RemoteRoomCreateRoadConstructionSiteTask {
    return new RemoteRoomCreateRoadConstructionSiteTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName): RemoteRoomCreateRoadConstructionSiteTask {
    return new RemoteRoomCreateRoadConstructionSiteTask(Game.time, [], roomName, targetRoomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    if (objects.constructionSites.length > 0) {
      return TaskStatus.InProgress
    }
    if (Game.time % 17 !== 3) {
      return TaskStatus.InProgress
    }
    this.placeConstructionSite(objects.controller.room, objects.flags)

    return TaskStatus.InProgress
  }

  private placeConstructionSite(room: Room, flags: Flag[]): void {
    const colorMap = new Map<ColorConstant, StructureConstant>([
      [COLOR_BROWN, STRUCTURE_ROAD],
      [COLOR_GREEN, STRUCTURE_STORAGE],
      [COLOR_PURPLE, STRUCTURE_TERMINAL],
      [COLOR_ORANGE, STRUCTURE_LINK],
      [COLOR_BLUE, STRUCTURE_LAB],
      [COLOR_RED, STRUCTURE_TOWER],
      [COLOR_GREY, STRUCTURE_SPAWN],
      [COLOR_CYAN, STRUCTURE_NUKER],
      [COLOR_WHITE, STRUCTURE_EXTENSION],
    ])

    for (const flag of flags) {
      const structureType = colorMap.get(flag.color)
      if (structureType == null) {
        continue
      }
      const result = room.createConstructionSite(flag.pos, structureType)
      switch (result) {
      case OK:
        flag.remove()
        return
      case ERR_NOT_OWNER:
      case ERR_INVALID_TARGET:
      case ERR_INVALID_ARGS:
        flag.remove()
        break
      case ERR_FULL:
      case ERR_RCL_NOT_ENOUGH:
        break
      }
    }
  }
}

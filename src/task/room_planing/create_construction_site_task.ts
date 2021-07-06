import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"

export interface CreateConstructionSiteTaskState extends TaskState {
  /** room name */
  r: RoomName
}

export class CreateConstructionSiteTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): CreateConstructionSiteTaskState {
    return {
      t: "CreateConstructionSiteTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: CreateConstructionSiteTaskState): CreateConstructionSiteTask {
    const children = decodeTasksFrom(state.c)
    return new CreateConstructionSiteTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): CreateConstructionSiteTask {
    return new CreateConstructionSiteTask(Game.time, [], roomName)
  }

  public description(): string {
    return `${this.constructor.name}_${this.roomName}`
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

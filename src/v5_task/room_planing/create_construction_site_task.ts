import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "v5_task/task_state"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"

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

const structurePriority: StructureConstant[] = [
  STRUCTURE_TOWER,
  STRUCTURE_SPAWN,
  STRUCTURE_STORAGE,
  STRUCTURE_TERMINAL,
  STRUCTURE_EXTENSION,
  STRUCTURE_LINK,
  STRUCTURE_ROAD,
  STRUCTURE_LAB,
  STRUCTURE_NUKER,
]

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

  public static decode(state: CreateConstructionSiteTaskState, children: Task[]): CreateConstructionSiteTask {
    return new CreateConstructionSiteTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): CreateConstructionSiteTask {
    return new CreateConstructionSiteTask(Game.time, [], roomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const wallTypes: StructureConstant[] = [
      STRUCTURE_RAMPART,
      STRUCTURE_WALL,
    ]
    if (objects.constructionSites.filter(site => wallTypes.includes(site.structureType) !== true).length > 0) {
      return TaskStatus.InProgress
    }
    if (Game.time % 17 !== 3) {
      return TaskStatus.InProgress
    }
    const centerPosition: RoomPosition = objects.activeStructures.storage?.pos ?? objects.activeStructures.spawns[0]?.pos ?? (new RoomPosition(25, 25, objects.controller.room.name))
    this.placeConstructionSite(objects.controller.room, objects.flags, centerPosition)

    return TaskStatus.InProgress
  }

  private placeConstructionSite(room: Room, flags: Flag[], centerPosition: RoomPosition): void {
    if (room.controller == null) {
      PrimitiveLogger.fatal(`[Probram bug] Room ${roomLink(room.name)} doesn't have a controller ${this.constructor.name}`)
      return
    }
    if (World.rooms.getAllOwnedRooms().length > 1 && room.controller.level <= 2) {
      return
    }

    const sortedFlags = flags.sort((lhs, rhs) => {
      const lStructureType = colorMap.get(lhs.color)
      if (lStructureType == null) {
        return 1
      }
      const rStructureType = colorMap.get(rhs.color)
      if (rStructureType == null) {
        return -1
      }
      const lPriority = structurePriority.indexOf(lStructureType)
      if (lPriority < 0) {
        return 1
      }
      const rPriority = structurePriority.indexOf(rStructureType)
      if (rPriority < 0) {
        return -1
      }
      if (lPriority === rPriority) {
        return lhs.pos.getRangeTo(centerPosition) - rhs.pos.getRangeTo(centerPosition)
      }
      return lPriority < rPriority ? -1 : 1
    })

    for (const flag of sortedFlags) {
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
        break
      case ERR_RCL_NOT_ENOUGH:
        if (structureType === STRUCTURE_SPAWN) {
          switch (room.createConstructionSite(flag.pos, STRUCTURE_POWER_SPAWN)) {
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
        break
      }
    }
  }
}

import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { TaskState } from "v5_task/task_state"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { RoomResources } from "room_resource/room_resources"

export const constructionSiteFlagColorMap = new Map<ColorConstant, StructureConstant>([
  [COLOR_BROWN, STRUCTURE_ROAD],
  [COLOR_GREEN, STRUCTURE_STORAGE],
  [COLOR_PURPLE, STRUCTURE_TERMINAL],
  [COLOR_ORANGE, STRUCTURE_LINK],
  [COLOR_BLUE, STRUCTURE_LAB],
  [COLOR_RED, STRUCTURE_TOWER],
  [COLOR_GREY, STRUCTURE_SPAWN],
  [COLOR_CYAN, STRUCTURE_NUKER],
  [COLOR_WHITE, STRUCTURE_EXTENSION],
  [COLOR_YELLOW, STRUCTURE_CONTAINER],
])

const structurePriority: StructureConstant[] = [
  STRUCTURE_TOWER,
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_STORAGE,
  STRUCTURE_TERMINAL,
  STRUCTURE_LINK,
  STRUCTURE_ROAD,
  STRUCTURE_CONTAINER,
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

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    const concurrentConstructionSites = roomResource?.roomInfo.config?.concurrentConstructionSites ?? 1

    if (objects.constructionSites.filter(site => wallTypes.includes(site.structureType) !== true).length >= concurrentConstructionSites) {
      return TaskStatus.InProgress
    }

    const interval = roomResource?.roomInfo.config?.constructionInterval ?? 17
    if ((Game.time % interval) !== 0) {
      return TaskStatus.InProgress
    }
    const centerPosition = ((): RoomPosition => {
      const resources = RoomResources.getOwnedRoomResource(this.roomName)
      if (resources != null && resources.roomInfo.roomPlan != null) {
        const center = resources.roomInfo.roomPlan.centerPosition
        try {
          return new RoomPosition(center.x, center.y, this.roomName)
        } catch (e) {
          PrimitiveLogger.programError(`${this.taskIdentifier} failed to build RoomPosition object for ${center.x},${center.y} ${roomLink(this.roomName)}`)
        }
      }
      return objects.activeStructures.storage?.pos ?? objects.activeStructures.spawns[0]?.pos ?? (new RoomPosition(25, 25, objects.controller.room.name))
    })()
    const availableEnergy = (objects.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      + (objects.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
    this.placeConstructionSite(objects.controller.room, [...objects.flags], centerPosition, availableEnergy)

    return TaskStatus.InProgress
  }

  private placeConstructionSite(room: Room, flags: Flag[], centerPosition: RoomPosition, availableEnergy: number): void {
    if (room.controller == null) {
      PrimitiveLogger.fatal(`[Probram bug] Room ${roomLink(room.name)} doesn't have a controller ${this.constructor.name}`)
      return
    }

    const [shouldPlaceExtensions, shouldPlaceRoads] = ((): [boolean, boolean] => {
      if (World.rooms.getAllOwnedRooms().length <= 1) {
        if (room.controller.level <= 3) {
          return [true, false]
        }
        return [true, true]
      }
      if (room.controller.level < 3) {
        return [false, false]
      }
      if (room.controller.level < 4) {
        return [true, false]
      }
      return [true, true]
    })()
    const shouldPlaceContainer = room.controller.level >= 4
    const shouldPlaceLab = availableEnergy > 80000

    const sortedFlags = flags.sort((lhs, rhs) => {
      const lStructureType = constructionSiteFlagColorMap.get(lhs.color)
      if (lStructureType == null) {
        return 1
      }
      const rStructureType = constructionSiteFlagColorMap.get(rhs.color)
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
      const structureType = constructionSiteFlagColorMap.get(flag.color)
      if (structureType == null) {
        continue
      }
      if (structureType === STRUCTURE_EXTENSION && shouldPlaceExtensions !== true) {
        continue
      }
      if (structureType === STRUCTURE_ROAD) {
        if (shouldPlaceRoads !== true) {
          continue
        }
        const hasStructure = ((): boolean => {
          const placedStructure = flag.pos.findInRange(FIND_STRUCTURES, 0)
          if (placedStructure.length > 0) {
            return true
          }
          const constructionSites = flag.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 0)
          if (constructionSites.length > 0) {
            return true
          }
          const hasStructureFlag = flag.pos.findInRange(FIND_FLAGS, 0).some(f => f.color !== COLOR_BROWN)
          if (hasStructureFlag === true) {
            return true
          }
          return false
        })()
        if (hasStructure === true) {
          flag.remove()
          continue
        }
      }
      if (structureType === STRUCTURE_CONTAINER && shouldPlaceContainer !== true) {
        continue
      }
      if (structureType === STRUCTURE_LAB && shouldPlaceLab !== true) {
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

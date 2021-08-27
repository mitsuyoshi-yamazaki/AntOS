import { Problem } from "application/problem"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { TaskProgress } from "object_task/object_task"
import { CreepName, isV6Creep, V6Creep } from "prototype/creep"
import { RoomName } from "utility/room_name"
import { NormalRoomResource } from "./room_resource/normal_room_resource"
import { OwnedRoomCreepInfo, OwnedRoomResource } from "./room_resource/owned_room_resource"
import { RoomResource } from "./room_resource"
import { buildNormalRoomInfo, buildOwnedRoomInfo, OwnedRoomInfo, ResourceInsufficiency, RoomInfoType, updateNormalRoomInfo } from "./room_info"

interface RoomResourcesInterface {
  // ---- Lifecycle ---- //
  beforeTick(): void
  afterTick(): void

  // ---- Room Resource ---- //
  getOwnedRoomResources(): OwnedRoomResource[]
  getOwnedRoomResource(roomName: RoomName): OwnedRoomResource | null
  getRoomResource(roomName: RoomName): RoomResource | null
  getRoomInfo(roomName: RoomName): RoomInfoType | null

  // ---- Inter Room Resource ---- //
  getResourceInsufficientRooms(resourceType: ResourceConstant): { roomName: RoomName, priority: ResourceInsufficiency}[]
}

const ownedRoomResources = new Map<RoomName, OwnedRoomResource>()
const roomResources = new Map<RoomName, RoomResource>()
const allCreeps = new Map<RoomName, V6Creep[]>()
const creepProblems = new Map<CreepName, Problem[]>()

export const RoomResources: RoomResourcesInterface = {
  // ---- Lifecycle ---- //
  beforeTick(): void {
    roomResources.clear()
    enumerateCreeps()

    Object.entries(Game.rooms).forEach(([roomName, room]) => {
      if (room.controller != null && room.controller.my === true) {
        const creepInfo: OwnedRoomCreepInfo[] = (allCreeps.get(roomName) ?? []).map(creep => {
          return {
            creep,
            problems: creepProblems.get(creep.name) ?? [],
          }
        })

        const ownedRoomResource = buildOwnedRoomResource(room.controller, creepInfo)
        ownedRoomResources.set(roomName, ownedRoomResource)
        roomResources.set(roomName, ownedRoomResource)
      }

      updateRoomInfo(room)
    })
  },

  afterTick(): void {
    runCreepTasks()
    saveRoomInfo()
  },

  // ---- Room Resource ---- //
  getOwnedRoomResources(): OwnedRoomResource[] {
    return Array.from(ownedRoomResources.values())
  },

  getOwnedRoomResource(roomName: RoomName): OwnedRoomResource | null {
    return ownedRoomResources.get(roomName) ?? null
  },

  getRoomResource(roomName: RoomName): RoomResource | null {
    const stored = roomResources.get(roomName)
    if (stored != null) {
      return stored
    }
    const room = Game.rooms[roomName]
    if (room == null || room.controller == null) {
      return null
    }
    const roomResource = buildNormalRoomResource(room.controller)
    roomResources.set(roomName, roomResource)
    return roomResource
  },

  getRoomInfo(roomName: RoomName): RoomInfoType | null {
    return Memory.v6RoomInfo[roomName] ?? null
  },

  // ---- Inter Room Resource ---- //
  getResourceInsufficientRooms(resourceType: ResourceConstant): { roomName: RoomName, priority: ResourceInsufficiency }[] {
    const result: { roomName: RoomName, priority: ResourceInsufficiency }[] = []
    ownedRoomResources.forEach((ownedRoomResource, roomName) => {
      const insufficientResourcePriority = ownedRoomResource.roomInfo.resourceInsufficiencies[resourceType]
      if (insufficientResourcePriority == null) {
        return
      }
      result.push({
        roomName,
        priority: insufficientResourcePriority,
      })
    })
    return result
  },
}

function enumerateCreeps(): void {
  allCreeps.clear()

  for (const creepName in Memory.creeps) {
    const creep = Game.creeps[creepName]
    if (creep == null) {
      delete Memory.creeps[creepName]
      continue
    }
    if (!isV6Creep(creep)) {
      continue
    }
    const creeps = ((): V6Creep[] => {
      const stored = allCreeps.get(creep.memory.p)
      if (stored != null) {
        return stored
      }
      const newList: V6Creep[] = []
      allCreeps.set(creep.memory.p, newList)
      return newList
    })()

    creeps.push(creep)
  }
}

function updateRoomInfo(room: Room): void {
  const storedRoomInfo = RoomResources.getRoomInfo(room.name)
  if(storedRoomInfo == null) {
    Memory.v6RoomInfo[room.name] = createRoomInfo(room)
    return
  }

  switch (storedRoomInfo.roomType) {
  case "normal":
    updateNormalRoomInfo(room, storedRoomInfo)
    break
  case "owned":
    break
  }
}

function buildNormalRoomResource(controller: StructureController): NormalRoomResource {
  const roomInfo = Memory.v6RoomInfo[controller.room.name] ?? null
  return new NormalRoomResource(controller, roomInfo)
}

function buildOwnedRoomResource(controller: StructureController, creepInfo: OwnedRoomCreepInfo[]): OwnedRoomResource {
  const roomInfo = ((): OwnedRoomInfo => {
    const stored = Memory.v6RoomInfo[controller.room.name]
    if (stored != null) {
      if (stored.roomType === "owned") {

        // FixMe: Migration: 消す
        if (stored.neighbourRoomNames == null) {
          const getNeighbourRoomNames = (room: Room): RoomName[] => {
            const exits = Game.map.describeExits(room.name)
            if (exits == null) { // sim環境ではundefinedが返る
              return []
            }
            return Array.from(Object.values(exits))
          }
          stored.neighbourRoomNames = getNeighbourRoomNames(controller.room)
        }
        if (stored.numberOfSources == null) {
          stored.numberOfSources = controller.room.find(FIND_SOURCES).length
        }

        return stored
      }
      return buildOwnedRoomInfo(stored)
    }
    return buildOwnedRoomInfo(controller.room)
  })()
  return new OwnedRoomResource(controller, creepInfo, roomInfo)
}

function runCreepTasks(): void {
  creepProblems.clear()

  allCreeps.forEach(creeps => {
    creeps.forEach(creep => {
      ErrorMapper.wrapLoop((): void => {  // メモリの内容はnullである可能性があるため
        if (creep.task == null) {
          return
        }
        const task = creep.task
        const result = ErrorMapper.wrapLoop((): TaskProgress => {
          return task.run(creep)
        }, "creep.task.run()")()

        if (result == null) {
          return
        }

        const problems: Problem[] = []
        switch (result.progress) {
        case "in progress":
          problems.push(...result.problems)
          break

        case "finished":
          problems.push(...result.problems)
          creep.task = null
          break
        }

        if (problems.length <= 0) {
          return
        }
        creepProblems.set(creep.name, problems)
      }, "Run creep tasks")()
    })
  })
}

function saveRoomInfo(): void {
  roomResources.forEach((roomResource, roomName) => {
    const roomInfo = ((): RoomInfoType | null => {
      if (roomResource instanceof NormalRoomResource) {
        return roomResource.roomInfo
      }
      return null
    })()

    if (roomInfo == null) {
      return
    }
    Memory.v6RoomInfo[roomName] = roomInfo
  })
}

function createRoomInfo(room: Room): RoomInfoType {
  if (room.controller != null && room.controller.my === true) {
    return buildOwnedRoomInfo(room)
  }
  return buildNormalRoomInfo(room)
}

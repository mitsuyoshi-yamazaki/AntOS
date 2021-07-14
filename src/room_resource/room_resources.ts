import { TaskIdentifier } from "application/task_identifier"
import { CreepApiError } from "object_task/creep_task/creep_api"
import { CreepName, isV6CreepMemory } from "prototype/creep"
import { RoomName } from "utility/room_name"
import { ShortVersion } from "utility/system_info"
import { decodeRoomInfo, RoomInfo } from "world_info/room_info"
import { NormalRoomResource } from "./room_resource/normal_room_resource"
import { OwnedRoomResource } from "./room_resource/owned_room_resource"
import { RoomResource } from "./room_resource/room_resource"

interface RoomResources {
  // ---- Lifecycle ---- //
  beforeTick(): void
  afterTick(): void

  // ---- Room Resource ---- //
  getRoomResource(roomName: RoomName): RoomResource | null

  // ---- Creep ---- //
  getCreepApiError(taskIdentifier: TaskIdentifier): CreepApiError[]
}

const roomResources = new Map<RoomName, RoomResource>()
const allCreeps = new Map<RoomName, Creep[]>()
const creepApiErrors = new Map<TaskIdentifier, CreepApiError[]>()

export const RoomResources = {
  // ---- Lifecycle ---- //
  beforeTick(): void {
    roomResources.clear()
    enumerateCreeps()

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName]

      if (room.controller != null && room.controller.my === true) {
        roomResources.set(roomName, buildOwnedRoomResource(room.controller, allCreeps.get(roomName) ?? []))
      }
    }
  },

  afterTick(): void {
    runCreepTasks()
  },

  // ---- Room Resource ---- //
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

  // ---- Creep ---- //
  getCreepApiError(taskIdentifier: TaskIdentifier): CreepApiError[] {
    return creepApiErrors.get(taskIdentifier) ?? []
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
    if (!isV6CreepMemory(creep.memory)) {
      continue
    }
    const creeps = ((): Creep[] => {
      const stored = allCreeps.get(creep.memory.p)
      if (stored != null) {
        return stored
      }
      const newList: Creep[] = []
      allCreeps.set(creep.memory.p, newList)
      return newList
    })()

    creeps.push(creep)
  }
}

function buildNormalRoomResource(controller: StructureController): NormalRoomResource {
  const roomInfo = ((): RoomInfo | null => {
    const roomInfoMemory = Memory.room_info[controller.room.name]
    if (roomInfoMemory == null) {
      return null
    }
    return decodeRoomInfo(roomInfoMemory)
  })()
  return new NormalRoomResource(controller, roomInfo)
}

function buildOwnedRoomResource(controller: StructureController, creeps: Creep[]): OwnedRoomResource {
  const roomInfo = ((): RoomInfo => {
    const roomInfoMemory = Memory.room_info[controller.room.name]
    if (roomInfoMemory == null) {
      return {
        version: ShortVersion.v6,
        energySourceStructures: [],
        energyStoreStructures: [],
        upgrader: null,
        distributor: null,
      }
    }
    return decodeRoomInfo(roomInfoMemory)
  })()
  return new OwnedRoomResource(controller, [...creeps], roomInfo)
}

function runCreepTasks(): void {
  creepApiErrors.clear()

  allCreeps.forEach(creeps => {
    creeps.forEach(creep => {
      if (creep.task == null) {
        return
      }
      const result = creep.task.run(creep)
      const apiErrors: CreepApiError[] = []
      switch (result.progress) {
      case "in progress":
        apiErrors.push(...result.apiErrors)
        break

      case "finished":
        apiErrors.push(...result.apiErrors)
        creep.task = null
        break
      }

      if (apiErrors.length <= 0) {
        return
      }
      const creepMemory = creep.memory
      if (!isV6CreepMemory(creepMemory)) {
        return
      }
      const taskIdentifier = creepMemory.i
      if (taskIdentifier == null) {
        return
      }

      const creepApiErrorMap = ((): CreepApiError[] => {
        const stored = creepApiErrors.get(taskIdentifier)
        if (stored != null) {
          return stored
        }
        const newList: CreepApiError[] = []
        creepApiErrors.set(taskIdentifier, newList)
        return newList
      })()

      creepApiErrorMap.push(...apiErrors)
    })
  })
}

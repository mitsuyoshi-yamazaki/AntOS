import { Problem } from "application/problem"
import { TaskIdentifier } from "application/task_identifier"
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { TaskProgress } from "object_task/object_task"
import { CreepName, isV6Creep, V6Creep } from "prototype/creep"
import { RoomName } from "utility/room_name"
import { ShortVersion } from "utility/system_info"
import { decodeRoomInfo, RoomInfo } from "world_info/room_info"
import { NormalRoomResource } from "./room_resource/normal_room_resource"
import { OwnedRoomResource } from "./room_resource/owned_room_resource"
import { RoomResource } from "./room_resource/room_resource"

interface RoomResourcesInterface {
  // ---- Lifecycle ---- //
  beforeTick(): void
  afterTick(): void

  // ---- Room Resource ---- //
  getRoomResource(roomName: RoomName): RoomResource | null

  // ---- Creep ---- //
  getCreepProblems(taskIdentifier: TaskIdentifier): CreepProblemMap | null
}

export type CreepProblemMap = Map<CreepName, Problem[]>

const roomResources = new Map<RoomName, RoomResource>()
const allCreeps = new Map<RoomName, V6Creep[]>()
const creepProblems = new Map<TaskIdentifier, CreepProblemMap>()

export const RoomResources: RoomResourcesInterface = {
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
  getCreepProblems(taskIdentifier: TaskIdentifier): CreepProblemMap | null {
    return creepProblems.get(taskIdentifier) ?? null
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
        const taskIdentifier = creep.memory.i

        const creepProblemMap = ((): CreepProblemMap => {
          const stored = creepProblems.get(taskIdentifier)
          if (stored != null) {
            return stored
          }
          const newMap = new Map<CreepName, Problem[]>()
          creepProblems.set(taskIdentifier, newMap)
          return newMap
        })()

        creepProblemMap.set(creep.name, problems)
      }, "Run creep tasks")()
    })
  })
}

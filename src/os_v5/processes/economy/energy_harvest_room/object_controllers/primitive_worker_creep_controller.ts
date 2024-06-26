import { CreepTask } from "os_v5/processes/game_object_management/creep/creep_task/creep_task"
import { RoomName } from "shared/utility/room_name_types"
import { EnergyHarvestRoomProcessCreep } from "../types"

export class PrimitiveWorkerCreepController {
  public constructor() {}

  public run(creep: EnergyHarvestRoomProcessCreep, roomName: RoomName): void {
    if (creep.task != null) {
      return
    }
    // creep.task = this.workerTaskFor(creep)
    this.runDirectly(creep, roomName)
  }

  private runDirectly(creep: EnergyHarvestRoomProcessCreep, roomName: RoomName): void {
    if (creep.room.name !== roomName) {
      creep.task = CreepTask.Tasks.MoveToRoom.create(roomName, [])
      return
    }

    // TODO: CreepTaskへ移す
    switch (creep.memory.tempState) {
    case "harvesting": {
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
        creep.memory.tempState = "working"
        return
      }
      const source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE)
      if (source == null) {
        if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
          creep.memory.tempState = "working"
        }
        return
      }
      if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source)
      }
      return
    }

    case "working": {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
        creep.memory.tempState = "harvesting"
        return
      }

      const controller = creep.room.controller
      if (controller == null) {
        return
      }
      if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(controller)
      }
      return
    }
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = creep.memory.tempState
      return
    }
    }
  }
}

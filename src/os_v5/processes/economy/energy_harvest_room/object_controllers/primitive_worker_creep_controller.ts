import { CreepTask } from "os_v5/processes/game_object_management/creep/creep_task/creep_task"
import { RoomName } from "shared/utility/room_name_types"
import { GameConstants } from "utility/constants"
import { EnergyHarvestRoomProcessCreep } from "../types"

export class PrimitiveWorkerCreepController {
  public constructor() {}

  public run(creep: EnergyHarvestRoomProcessCreep, roomName: RoomName): void {
    if (creep.task != null) {
      return
    }
    creep.task = this.workerTaskFor(creep, roomName)
  }

  private workerTaskFor(creep: EnergyHarvestRoomProcessCreep, roomName: RoomName): CreepTask.AnyTask | null {
    if (creep.room.name !== roomName) {
      return CreepTask.Tasks.MoveToRoom.create(roomName, [])
    }

    const source = creep.pos.findClosestByRange(FIND_SOURCES)
    if (source == null) {
      return null // FixMe: 一度に全ての状態を設定するので、タスク状態とCreepMemory両方で無駄が発生している
    }
    const controller = creep.room.controller
    if (controller == null) {
      return null
    }

    const tasks: CreepTask.AnyTask[] = [
      CreepTask.Tasks.MoveTo.create(source.pos, GameConstants.creep.actionRange.harvest),
      CreepTask.Tasks.HarvestEnergy.create(source.id),
      CreepTask.Tasks.MoveTo.create(controller.pos, GameConstants.creep.actionRange.upgradeController),
      CreepTask.Tasks.UpgradeController.create(controller.id),
    ]
    return CreepTask.Tasks.Sequential.create(tasks)
  }
}

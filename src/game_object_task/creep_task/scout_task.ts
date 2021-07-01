import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { RoomName } from "prototype/room"

export interface ScoutTaskState extends CreepTaskState {
  /** target room name */
  r: RoomName
}

export class ScoutTask implements CreepTask {
  public readonly shortDescription = "scout"

  public constructor(
    public readonly startTime: number,
    public readonly roomName: RoomName,
  ) { }

  public encode(): ScoutTaskState {
    return {
      s: this.startTime,
      t: "BuildTask",
      r: this.roomName,
    }
  }

  public static decode(state: ScoutTaskState): ScoutTask {
    return new ScoutTask(state.s, state.r)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    creep.memory.tt = Game.time
    if (creep.room.name !== this.roomName) {
      creep.moveToRoom(this.roomName)
      return "in progress"
    }

    const hostileAttackers = creep.room.find(FIND_HOSTILE_CREEPS).filter(creep => {
      const body = creep.body.map(b => b.type)
      if (body.includes(ATTACK) === true) {
        return true
      }
      if (body.includes(RANGED_ATTACK) === true) {
        return true
      }
      return false
    })
    const hostileAttacker = creep.pos.findClosestByRange(hostileAttackers)
    if (hostileAttacker != null) {
      const path = PathFinder.search(creep.pos, hostileAttacker.pos, {
        flee: true,
        maxRooms: 1,
      })
      creep.moveByPath(path.path)
      return "in progress"
    }

    if (creep.pos.inRangeTo(25, 25, 3) !== true) {
      creep.moveTo(25, 25, { reusePath: 0 })
      return "in progress"
    }
    return "in progress"
  }
}

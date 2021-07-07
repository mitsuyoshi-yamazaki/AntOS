import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { RoomName } from "utility/room_name"

export interface ScoutTaskState extends CreepTaskState {
  /** position */
  p: { x: number, y: number, r: RoomName }
}

export class ScoutTask implements CreepTask {
  public readonly shortDescription = "scout"

  public constructor(
    public readonly startTime: number,
    public readonly position: RoomPosition,
  ) { }

  public encode(): ScoutTaskState {
    return {
      s: this.startTime,
      t: "BuildTask",
      p: {
        x: this.position.x,
        y: this.position.y,
        r: this.position.roomName,
      },
    }
  }

  public static decode(state: ScoutTaskState): ScoutTask {
    const position = new RoomPosition(state.p.x, state.p.y, state.p.r)
    return new ScoutTask(state.s, position)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    if (creep.room.name !== this.position.roomName) {
      creep.moveToRoom(this.position.roomName)
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

    creep.moveTo(this.position, { reusePath: 0 })
    return "in progress"
  }
}

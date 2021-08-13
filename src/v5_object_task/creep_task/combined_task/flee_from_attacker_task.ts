import { randomDirection } from "utility/constants"
import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface FleeFromAttackerTaskState extends CreepTaskState {
  childTaskState: CreepTaskState
  didFlee: boolean
  range: number
}

export class FleeFromAttackerTask implements CreepTask {
  private constructor(
    public readonly startTime: number,
    public readonly childTask: CreepTask,
    private didFlee: boolean,
    private readonly range: number,
  ) {
  }

  public encode(): FleeFromAttackerTaskState {
    return {
      s: this.startTime,
      t: "FleeFromAttackerTask",
      childTaskState: this.childTask.encode(),
      didFlee: this.didFlee,
      range: this.range,
    }
  }

  public static decode(state: FleeFromAttackerTaskState, childTask: CreepTask): FleeFromAttackerTask {
    return new FleeFromAttackerTask(state.s, childTask, state.didFlee ?? false, state.range ?? 6)
  }

  public static create(childTask: CreepTask, range?: number): FleeFromAttackerTask {
    return new FleeFromAttackerTask(Game.time, childTask, false, range ?? 6)
  }

  public run(creep: Creep): TaskProgressType {
    const whitelist = Memory.gameInfo.sourceHarvestWhitelist || []
    const hostileAttacker = creep.pos.findClosestByRange(creep.room.find(FIND_HOSTILE_CREEPS)
      .filter(creep => {
        if (whitelist.includes(creep.owner.username) === true) {
          return false
        }
        return (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0)
      }))
    if (hostileAttacker != null && hostileAttacker.pos.getRangeTo(creep.pos) <= this.range) {
      this.didFlee = true
      this.fleeFrom(hostileAttacker.pos, creep, this.range + 1)
      return TaskProgressType.InProgress
    }
    if (this.didFlee === true) {
      this.didFlee = false
      creep.move(randomDirection(Game.time + this.startTime))
      return TaskProgressType.InProgress
    }
    return this.childTask.run(creep)
  }

  private fleeFrom(position: RoomPosition, creep: Creep, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 1,
    })
    creep.moveByPath(path.path)
  }
}

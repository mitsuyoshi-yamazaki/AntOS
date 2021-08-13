import { randomDirection } from "utility/constants"
import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface FleeFromSKLairTaskState extends CreepTaskState {
  childTaskState: CreepTaskState
  didFlee: boolean
}

export class FleeFromSKLairTask implements CreepTask {
  private constructor(
    public readonly startTime: number,
    public readonly childTask: CreepTask,
    private didFlee: boolean,
  ) {
  }

  public encode(): FleeFromSKLairTaskState {
    return {
      s: this.startTime,
      t: "FleeFromSKLairTask",
      childTaskState: this.childTask.encode(),
      didFlee: this.didFlee,
    }
  }

  public static decode(state: FleeFromSKLairTaskState, childTask: CreepTask): FleeFromSKLairTask {
    return new FleeFromSKLairTask(state.s, childTask, state.didFlee)
  }

  public static create(childTask: CreepTask): FleeFromSKLairTask {
    return new FleeFromSKLairTask(Game.time, childTask, false)
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
    const range = 4
    if (hostileAttacker != null && hostileAttacker.pos.getRangeTo(creep.pos) <= range) {
      this.didFlee = true
      this.fleeFrom(hostileAttacker.pos, creep, range + 1)
      return TaskProgressType.InProgress
    }

    const lair = creep.pos.findInRange(FIND_HOSTILE_STRUCTURES, range + 1, { filter: { structureType: STRUCTURE_KEEPER_LAIR } })[0] as StructureKeeperLair | null
    if (lair != null && lair.ticksToSpawn != null && lair.ticksToSpawn < 5) {
      this.didFlee = true
      this.fleeFrom(lair.pos, creep, range + 1)
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

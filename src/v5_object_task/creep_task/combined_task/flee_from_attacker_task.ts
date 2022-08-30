import { RoomResources } from "room_resource/room_resources"
import { randomDirection } from "utility/constants"
import { TaskProgressType } from "v5_object_task/object_task"
import { TaskTargetTypeId } from "v5_object_task/object_task_target_cache"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface FleeFromAttackerTaskState extends CreepTaskState {
  childTaskState: CreepTaskState
  didFlee: boolean
  range: number
  failOnFlee: boolean
}

export class FleeFromAttackerTask implements CreepTask {
  public get targetId(): TaskTargetTypeId | undefined {
    return this.childTask.targetId
  }

  private constructor(
    public readonly startTime: number,
    public readonly childTask: CreepTask,
    private didFlee: boolean,
    private readonly range: number,
    private readonly failOnFlee: boolean,
  ) {
  }

  public encode(): FleeFromAttackerTaskState {
    return {
      s: this.startTime,
      t: "FleeFromAttackerTask",
      childTaskState: this.childTask.encode(),
      didFlee: this.didFlee,
      range: this.range,
      failOnFlee: this.failOnFlee,
    }
  }

  public static decode(state: FleeFromAttackerTaskState, childTask: CreepTask): FleeFromAttackerTask {
    return new FleeFromAttackerTask(state.s, childTask, state.didFlee ?? false, state.range ?? 6, state.failOnFlee ?? true)
  }

  public static create(childTask: CreepTask, range?: number, options?: {failOnFlee?: boolean}): FleeFromAttackerTask {
    return new FleeFromAttackerTask(Game.time, childTask, false, range ?? 4, options?.failOnFlee ?? false)
  }

  public run(creep: Creep): TaskProgressType {
    const roomResource = RoomResources.getNormalRoomResource(creep.room.name)
    if (roomResource == null || (roomResource.hostiles.creeps.length > 0 && roomResource.controller.safeMode == null)) {
      const whitelist = Memory.gameInfo.sourceHarvestWhitelist ?? []
      const hostileAttacker = creep.pos.findClosestByRange(creep.room.find(FIND_HOSTILE_CREEPS)
        .filter(creep => {
          if (Game.isEnemy(creep.owner) !== true) {
            return false
          }
          if (whitelist.includes(creep.owner.username) === true) {
            return false
          }
          return (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0)
        }))
      if (hostileAttacker != null && hostileAttacker.pos.getRangeTo(creep.pos) <= this.range) {
        this.didFlee = true
        this.fleeFrom(hostileAttacker.pos, creep, this.range + 1)
        return TaskProgressType.FinishedAndRan
      }
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

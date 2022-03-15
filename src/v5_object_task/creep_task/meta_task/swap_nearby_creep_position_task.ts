import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

type Options = {
  readonly onRoadOnly: boolean
}

export interface SwapNearbyCreepPositionTaskState extends CreepTaskState {
  readonly options: Options
}

export class SwapNearbyCreepPositionTask implements CreepTask {
  private constructor(
    public readonly startTime: number,
    private readonly options: Options,
  ) {
  }

  public encode(): SwapNearbyCreepPositionTaskState {
    return {
      s: this.startTime,
      t: "SwapNearbyCreepPositionTask",
      options: this.options,
    }
  }

  public static decode(state: SwapNearbyCreepPositionTaskState): SwapNearbyCreepPositionTask | null {
    return new SwapNearbyCreepPositionTask(state.s, state.options)
  }

  public static create(options?: Partial<Options>): SwapNearbyCreepPositionTask {
    const solidOptions: Options = {
      onRoadOnly: options?.onRoadOnly ?? false,
    }
    return new SwapNearbyCreepPositionTask(Game.time, solidOptions)
  }

  public run(creep: Creep): TaskProgressType {
    const nearbyCreep = creep.pos.findInRange(FIND_MY_CREEPS, 1).find(c => c.name !== creep.name)
    if (nearbyCreep == null) {
      return TaskProgressType.Finished
    }

    if (this.options.onRoadOnly === true) {
      const roads = creep.pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_ROAD } }).filter(road => road.pos.isEqualTo(creep.pos) !== true)
      const movableRoad = roads.find(road => road.pos.findInRange(FIND_MY_CREEPS, 0).length <= 0)
      if (movableRoad == null) {
        return TaskProgressType.Finished
      }
      creep.move(creep.pos.getDirectionTo(movableRoad.pos))
      return TaskProgressType.FinishedAndRan
    }

    creep.move(creep.pos.getDirectionTo(nearbyCreep.pos))
    return TaskProgressType.FinishedAndRan
  }
}

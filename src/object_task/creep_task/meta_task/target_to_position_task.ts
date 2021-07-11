import { decodeRoomPosition, RoomPositionIdentifier, RoomPositionState } from "prototype/room_position"
import { TaskProgressType } from "object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { AnyCreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { defaultMoveToOptions, ERR_PROGRAMMING_ERROR } from "prototype/creep"

export interface TargetToPositionTaskState extends CreepTaskState {
  /** destination position */
  d: RoomPositionState

  /** api wrapper states */
  as: CreepApiWrapperState[]
}

export class TargetToPositionTask implements CreepTask {
  public readonly shortDescription: string

  public get targetId(): RoomPositionIdentifier {
    return this.destinationPosition.id
  }

  private constructor(
    public readonly startTime: number,
    public readonly destinationPosition: RoomPosition,
    public readonly apiWrappers: AnyCreepApiWrapper[],
  ) {
    this.shortDescription = `${this.destinationPosition.x},${this.destinationPosition.y}`
  }

  public encode(): TargetToPositionTaskState {
    return {
      s: this.startTime,
      t: "TargetToPositionTask",
      d: this.destinationPosition.encode(),
      as: this.apiWrappers.map(wrapper => wrapper.encode())
    }
  }

  public static decode(state: TargetToPositionTaskState): TargetToPositionTask | null {
    const apiWrappers: AnyCreepApiWrapper[] = []
    for (const wrapperState of state.as) {
      const wrapper = decodeCreepApiWrapperFromState(wrapperState)
      if (wrapper == null) {
        return null
      }
      apiWrappers.push(wrapper)
    }
    return new TargetToPositionTask(state.s, decodeRoomPosition(state.d), apiWrappers)
  }

  public static create(destinationPosition: RoomPosition, apiWrappers: AnyCreepApiWrapper[]): TargetToPositionTask {
    return new TargetToPositionTask(Game.time, destinationPosition, apiWrappers)
  }

  public run(creep: Creep): TaskProgressType {
    for (const wrapper of this.apiWrappers) {
      const result = wrapper.run(creep)
      if (result === ERR_PROGRAMMING_ERROR) {
        return TaskProgressType.FinishedAndRan
      }
    }

    if (creep.pos.isEqualTo(this.destinationPosition) !== true) {
      creep.moveTo(this.destinationPosition, defaultMoveToOptions)
    }
    return TaskProgressType.InProgress
  }
}

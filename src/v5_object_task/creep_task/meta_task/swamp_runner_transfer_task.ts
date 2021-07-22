import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { TargetingApiWrapperTargetType } from "v5_object_task/targeting_api_wrapper"
import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { TransferResourceApiWrapper, TransferResourceApiWrapperState } from "../api_wrapper/transfer_resource_api_wrapper"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

export interface SwampRunnerTransferTaskState extends CreepTaskState {
  /** api warpper state */
  as: TransferResourceApiWrapperState

  /** dropped resource location */
  d: RoomPositionState | null

  /** last tick position */
  p: RoomPositionState | null
}

/**
 * - 2体が協力して動けばdecayなしに1square/tickで運べる
 *   - 32 CARRY, 16 MOVE * 2 => 3200
 *   - 47 CARRY, 1 MOVE * 2 => 2350 (73%)
 * - [ ] waypointを設定できない
 */
export class SwampRunnerTransferTask implements CreepTask {
  public readonly shortDescription = "s-runner"
  public get targetId(): Id<TargetingApiWrapperTargetType> {
    return this.transferResourceApiWrapper.target.id
  }

  private constructor(
    public readonly startTime: number,
    private readonly transferResourceApiWrapper: TransferResourceApiWrapper,
    private droppedResourceLocation: RoomPosition | null,
    private lastTickPosition: RoomPosition | null,
  ) {
  }

  public encode(): SwampRunnerTransferTaskState {
    return {
      s: this.startTime,
      t: "SwampRunnerTransferTask",
      as: this.transferResourceApiWrapper.encode(),
      d: this.droppedResourceLocation?.encode() ?? null,
      p: this.lastTickPosition?.encode() ?? null,
    }
  }

  public static decode(state: SwampRunnerTransferTaskState): SwampRunnerTransferTask | null {
    const wrapper = TransferResourceApiWrapper.decode(state.as)
    if (wrapper == null) {
      return null
    }
    const parsePosition = ((roomPositionState: RoomPositionState | null): RoomPosition | null => {
      if (roomPositionState == null) {
        return null
      }
      return decodeRoomPosition(roomPositionState)
    })
    const resourceLocation = parsePosition(state.d)
    const lastTickPosition = parsePosition(state.p)
    return new SwampRunnerTransferTask(state.s, wrapper, resourceLocation, lastTickPosition)
  }

  public static create(apiWrapper: TransferResourceApiWrapper): SwampRunnerTransferTask {
    return new SwampRunnerTransferTask(Game.time, apiWrapper, null, null)
  }

  public run(creep: Creep): TaskProgressType {
    const lastTickPosition = this.lastTickPosition ?? creep.pos
    this.lastTickPosition = creep.pos

    return this.move(creep, lastTickPosition)
  }

  /**
   * - Room Borderを超える方法（Room A -> Room B）
   *   - 1. 48地点にdrop
   *   - 2. 49へ移動
   *   - 3. Room Bに移動
   *   - 4. 動かずRoom Aに戻る
   *   - 5. pickup
   *   - 6. 動かずRoom Bに戻る
   */
  private move(creep: Creep, lastTickPosition: RoomPosition): TaskProgressType {
    const resourceType = this.transferResourceApiWrapper.resourceType

    if (this.droppedResourceLocation == null) {
      const result = this.transferResourceApiWrapper.run(creep)

      switch (result) {
      case FINISHED:
        return TaskProgressType.Finished

      case FINISHED_AND_RAN:
        return TaskProgressType.FinishedAndRan

      case ERR_NOT_IN_RANGE:
        creep.drop(resourceType)
        creep.moveTo(this.transferResourceApiWrapper.target)
        this.droppedResourceLocation = creep.pos
        return TaskProgressType.InProgress

      case ERR_BUSY:
        return TaskProgressType.InProgress

      case ERR_PROGRAMMING_ERROR:
        return TaskProgressType.Finished
      }
    }

    if (this.droppedResourceLocation.roomName !== creep.room.name) {
      return TaskProgressType.InProgress
    }
    const droppedResource = this.droppedResourceLocation.findInRange(FIND_DROPPED_RESOURCES, 0).find(resource => resource.resourceType === resourceType)
    if (droppedResource == null) {
      creep.say("no resource")
      PrimitiveLogger.programError(`${this.constructor.name} cannot find dropped resource at ${this.droppedResourceLocation} in ${roomLink(this.droppedResourceLocation.roomName)}`)
      return TaskProgressType.InProgress
    }
    if (droppedResource.pos.isEqualTo(creep.pos) === true) {
      const stopped = droppedResource.pos.isEqualTo(lastTickPosition) === true
      if (stopped === true) {
        // 静止していた
        this.pickup(creep, droppedResource)
      } else {
        creep.moveTo(this.transferResourceApiWrapper.target)
      }
      return TaskProgressType.InProgress
    }
    this.pickup(creep, droppedResource)
    return TaskProgressType.InProgress
  }

  private pickup(creep: Creep, resource: Resource): void {
    const pickupResult = creep.pickup(resource)
    switch (pickupResult) {
    case OK:
      this.droppedResourceLocation = null
      return

    default:
      PrimitiveLogger.programError(`${this.constructor.name} pickup failed with ${pickupResult} at ${roomLink(creep.room.name)}`)
      return
    }
  }
}

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { defaultMoveToOptions } from "prototype/creep"

export interface TestRunHaulerTaskState extends CreepTaskState {
  /** destination position */
  d: RoomPositionState

  /** storage id */
  i: Id<StructureStorage>

  /** withdrawing */
  w: boolean
}

export class TestRunHaulerTask implements CreepTask {
  public readonly shortDescription = "test"

  private constructor(
    public readonly destinationPosition: RoomPosition,
    public readonly storage: StructureStorage,
    private withdrawing: boolean,
  ) {
  }

  public encode(): TestRunHaulerTaskState {
    return {
      t: "TestRunHaulerTask",
      d: this.destinationPosition.encode(),
      i: this.storage.id,
      w: this.withdrawing,
    }
  }

  public static decode(state: TestRunHaulerTaskState): TestRunHaulerTask | null {
    const storage = Game.getObjectById(state.i)
    if (storage == null) {
      return null
    }
    return new TestRunHaulerTask(decodeRoomPosition(state.d), storage, state.w)
  }

  public static create(destinationPosition: RoomPosition, storage: StructureStorage): TestRunHaulerTask {
    return new TestRunHaulerTask(destinationPosition, storage, true)
  }

  public run(creep: Creep): TaskProgressType {
    if (this.withdrawing === true) {
      const withdrawResult = creep.withdraw(this.storage, RESOURCE_ENERGY)
      switch (withdrawResult) {
      case OK:
        this.withdrawing = false
        return TaskProgressType.InProgress

      case ERR_NOT_IN_RANGE:
        creep.moveTo(this.storage, defaultMoveToOptions())
        return TaskProgressType.InProgress

      case ERR_BUSY:
        return TaskProgressType.InProgress

      default:
        PrimitiveLogger.programError(`${this.constructor.name} unexpected withdraw error ${withdrawResult}`)
        return TaskProgressType.InProgress
      }
    }

    if (creep.pos.getRangeTo(this.storage.pos) < 5) {
      creep.moveTo(this.destinationPosition, defaultMoveToOptions())
      return TaskProgressType.InProgress
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      creep.drop(RESOURCE_ENERGY)
      creep.moveTo(this.destinationPosition, defaultMoveToOptions())
      // const droppedResource = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 0)[0]
      // const talk = droppedResource == null ? "no" : "!"  // no
      // creep.say(talk)
    } else {
      const droppedResource = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0]
      if (droppedResource != null) {
        if (droppedResource.pos.isEqualTo(creep.pos) === true) {
          creep.moveTo(this.destinationPosition, defaultMoveToOptions())
          return TaskProgressType.InProgress
        }
        creep.pickup(droppedResource)
      }
    }
    return TaskProgressType.InProgress
  }
}

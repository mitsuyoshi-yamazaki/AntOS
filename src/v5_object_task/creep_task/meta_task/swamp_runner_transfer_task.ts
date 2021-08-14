import { ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN } from "prototype/creep"
import { TargetingApiWrapperTargetType } from "v5_object_task/targeting_api_wrapper"
import { TaskProgressType } from "v5_object_task/object_task"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { TransferResourceApiWrapper, TransferResourceApiWrapperState } from "../api_wrapper/transfer_resource_api_wrapper"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { RoomName, roomTypeOf } from "utility/room_name"
import { SourceKeeper } from "game/source_keeper"
import { OBSTACLE_COST } from "utility/constants"
import { WithdrawResourceApiWrapper, WithdrawResourceApiWrapperState } from "../api_wrapper/withdraw_resource_api_wrapper"

type ApiWrapperType = TransferResourceApiWrapper | WithdrawResourceApiWrapper

export interface SwampRunnerTransferTaskState extends CreepTaskState {
  /** api warpper state */
  as: TransferResourceApiWrapperState | WithdrawResourceApiWrapperState

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
    return this.apiWrapper.target.id
  }

  private constructor(
    public readonly startTime: number,
    private readonly apiWrapper: ApiWrapperType,
    private droppedResourceLocation: RoomPosition | null,
    private lastTickPosition: RoomPosition | null,
  ) {
  }

  public encode(): SwampRunnerTransferTaskState {
    return {
      s: this.startTime,
      t: "SwampRunnerTransferTask",
      as: this.apiWrapper.encode(),
      d: this.droppedResourceLocation?.encode() ?? null,
      p: this.lastTickPosition?.encode() ?? null,
    }
  }

  public static decode(state: SwampRunnerTransferTaskState, apiWrapper: ApiWrapperType): SwampRunnerTransferTask | null {
    const parsePosition = ((roomPositionState: RoomPositionState | null): RoomPosition | null => {
      if (roomPositionState == null) {
        return null
      }
      return decodeRoomPosition(roomPositionState)
    })
    const resourceLocation = parsePosition(state.d)
    const lastTickPosition = parsePosition(state.p)
    return new SwampRunnerTransferTask(state.s, apiWrapper, resourceLocation, lastTickPosition)
  }

  public static create(apiWrapper: ApiWrapperType): SwampRunnerTransferTask {
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
    const resourceType = this.apiWrapper.resourceType

    if (this.droppedResourceLocation == null) {
      const result = this.apiWrapper.run(creep)

      switch (result) {
      case FINISHED:
        return TaskProgressType.Finished

      case FINISHED_AND_RAN:
        return TaskProgressType.FinishedAndRan

      case ERR_NOT_IN_RANGE:
        creep.drop(resourceType)
        this.moveCreep(creep)
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
      PrimitiveLogger.fatal(`${this.constructor.name} cannot find dropped resource at ${this.droppedResourceLocation} in ${roomLink(this.droppedResourceLocation.roomName)}`)
      return TaskProgressType.Finished
    }
    if (droppedResource.pos.isEqualTo(creep.pos) === true) {
      const stopped = droppedResource.pos.isEqualTo(lastTickPosition) === true
      if (stopped === true) {
        // 静止していた
        this.pickup(creep, droppedResource) // FixMe: 部屋の境界で静止していた場合
      } else {
        this.moveCreep(creep)
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

  private moveCreep(creep: Creep): void {
    const reusePath = 20
    const noPathFindingOptions: MoveToOpts = {
      noPathFinding: true,
      reusePath,
    }

    const moveToOptions = ((): MoveToOpts => {
      const options: MoveToOpts = {}
      options.reusePath = reusePath
      options.swampCost = 1
      if (roomTypeOf(creep.room.name) !== "source_keeper") {
        return options
      }
      creep.say("SK room")
      // 保存されたパスがあれば計算はスキップする

      const roomPositionFilteringOptions: RoomPositionFilteringOptions = {
        excludeItself: false,
        excludeTerrainWalls: false,
        excludeStructures: false,
        excludeWalkableStructures: false,
      }

      options.maxOps = 2000
      const sourceKeepers = creep.room.find(FIND_HOSTILE_CREEPS)
        .filter(creep => creep.owner.username === SourceKeeper.username)
      const positionsToAvoid = sourceKeepers
        .flatMap(creep => creep.pos.positionsInRange(4, roomPositionFilteringOptions))

      options.costCallback = (roomName: RoomName, costMatrix: CostMatrix): CostMatrix | void => {
        if (roomName !== creep.room.name) {
          return
        }
        positionsToAvoid.forEach(position => {
          // creep.room.visual.text("x", position.x, position.y, { align: "center", color: "#ff0000" })
          costMatrix.set(position.x, position.y, OBSTACLE_COST)
        })
        return costMatrix
      }
      return options
    })

    if (creep.moveTo(this.apiWrapper.target, noPathFindingOptions) === ERR_NOT_FOUND) {
      creep.moveTo(this.apiWrapper.target, moveToOptions())
    }
  }
}

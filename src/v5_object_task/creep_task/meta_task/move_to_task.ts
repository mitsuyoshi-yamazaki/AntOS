import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { TaskProgressType } from "v5_object_task/object_task"
import { roomLink } from "utility/log"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { interRoomMoveToOptions } from "prototype/creep"
import type { RoomName } from "shared/utility/room_name_types"
import { GameConstants } from "utility/constants"

export interface MoveToTaskState extends CreepTaskState {
  /** destination position */
  d: RoomPositionState

  /** range */
  r: number

  ignoreSwamp: boolean
  isAllyRoom: boolean
}

export class MoveToTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly destinationPosition: RoomPosition,
    public readonly range: number,
    public readonly ignoreSwamp: boolean,
    private readonly isAllyRoom: boolean,
  ) {
    this.shortDescription = `${this.destinationPosition.x},${this.destinationPosition.y}`
  }

  public encode(): MoveToTaskState {
    return {
      s: this.startTime,
      t: "MoveToTask",
      d: this.destinationPosition.encode(),
      r: this.range,
      ignoreSwamp: this.ignoreSwamp,
      isAllyRoom: this.isAllyRoom,
    }
  }

  public static decode(state: MoveToTaskState): MoveToTask {
    return new MoveToTask(state.s, decodeRoomPosition(state.d), state.r, state.ignoreSwamp ?? false, state.isAllyRoom ?? false)
  }

  public static create(destinationPosition: RoomPosition, range: number, options?: { ignoreSwamp?: boolean, isAllyRoom?: boolean}): MoveToTask {
    return new MoveToTask(Game.time, destinationPosition, range, options?.ignoreSwamp ?? false, options?.isAllyRoom ?? false)
  }

  public run(creep: Creep): TaskProgressType {
    if (creep.pos.getRangeTo(this.destinationPosition) <= this.range) {
      return TaskProgressType.Finished
    }

    const result = creep.moveTo(this.destinationPosition, this.moveToOpts())
    switch (result) {
    case OK:
      return TaskProgressType.InProgress

    case ERR_BUSY:
    case ERR_TIRED:
    case ERR_NO_BODYPART:
      return TaskProgressType.InProgress

    case ERR_NO_PATH:
      return TaskProgressType.InProgress  // Creepが動き続けており、時間経過で解決する可能性があるため

    case ERR_NOT_OWNER:
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
      PrimitiveLogger.fatal(`creep.moveTo() returns ${result}, ${creep.name} in ${roomLink(creep.room.name)}`)
      return TaskProgressType.Finished
    }
  }

  private moveToOpts(): MoveToOpts {
    const options = interRoomMoveToOptions()
    if (this.ignoreSwamp === true) {
      options.ignoreRoads = true
      options.swampCost = 1
    }
    if (this.isAllyRoom === true) {
      options.ignoreCreeps = false
      options.costCallback = avoidConstructionSitesCostCallback
    }
    return options
  }
}

export const avoidConstructionSitesCostCallback = (roomName: RoomName, costMatrix: CostMatrix): CostMatrix | void => {
  const room = Game.rooms[roomName]
  if (room == null) {
    return costMatrix
  }

  const constructionSites = room.find(FIND_HOSTILE_CONSTRUCTION_SITES)
  const obstacleCost = GameConstants.pathFinder.costs.obstacle

  constructionSites.forEach(constructionSite => {
    costMatrix.set(constructionSite.pos.x, constructionSite.pos.y, obstacleCost)
  })

  return costMatrix
}

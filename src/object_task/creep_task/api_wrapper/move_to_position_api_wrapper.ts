import { CreepDamagedProblem } from "application/problem/creep/creep_damaged_problem"
import { PathNotFoundProblem } from "application/problem/creep/path_not_found_problem"
import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { TaskTargetPosition } from "object_task/object_task_target_cache"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { defaultMoveToOptions, V6Creep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"
import { MoveToApiOptions } from "./move_to_api_options"

const apiWrapperType = "MoveToPositionApiWrapper"

export interface MoveToPositionApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "MoveToPositionApiWrapper"

  /** room position */
  p: RoomPositionState

  /** options */
  o: MoveToApiOptions
}

// TODO: 動いていないことを検出する
// TODO: Sourceなどは隣接セルに対して移動する・targetedByにあと何tickで移動するかがamountで入っていれば
export class MoveToPositionApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription: string
  public readonly range = 0

  private constructor(
    public readonly target: RoomPosition,
    public readonly options: MoveToApiOptions,
  ) {
    this.shortDescription = `${this.target.x},${this.target.y}`
  }

  public encode(): MoveToPositionApiWrapperState {
    return {
      t: apiWrapperType,
      p: this.target.encode(),
      o: this.options,
    }
  }

  public static decode(state: MoveToPositionApiWrapperState): MoveToPositionApiWrapper {
    const position = decodeRoomPosition(state.p)
    return new MoveToPositionApiWrapper(position, state.o)
  }

  public static create(position: RoomPosition, options?: MoveToApiOptions): MoveToPositionApiWrapper {
    return new MoveToPositionApiWrapper(position, options ?? defaultMoveToOptions())
  }

  public taskTarget(): TaskTargetPosition {
    return {
      taskTargetType: "position",
      position: this.target,
      concreteTarget: null,
      taskType: "move",
      amount: 0,  // TODO: どれだけ滞在するかわかれば
    }
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    if (creep.pos.isEqualTo(this.target) === true) {
      return CreepApiWrapperProgress.Finished(false)
    }

    const result = creep.moveTo(this.target, this.options)

    switch (result) {
    case OK:
    case ERR_BUSY:
    case ERR_TIRED:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NO_PATH:
      return CreepApiWrapperProgress.Failed(new PathNotFoundProblem(creep.pos, this.target))

    case ERR_NO_BODYPART:
      return CreepApiWrapperProgress.Failed(new CreepDamagedProblem(creep.memory.p, creep.room.name))

    case ERR_NOT_OWNER:
    case ERR_NOT_FOUND:
    case ERR_INVALID_TARGET:
    default:
      return CreepApiWrapperProgress.Failed(new UnexpectedCreepProblem(creep.memory.p, creep.room.name, apiWrapperType, result))
    }
  }
}

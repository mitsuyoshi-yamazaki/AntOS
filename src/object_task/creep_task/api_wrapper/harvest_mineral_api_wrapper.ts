import { CreepDamagedProblem } from "application/problem/creep/creep_damaged_problem"
import { HarvestingRoomLostProblem } from "application/problem/creep/harvesting_room_lost_problem"
import { MissingTargetStructureProblem } from "application/problem/creep/missing_target_structure_problem"
import { UnexpectedCreepProblem } from "application/problem/creep/unexpected_creep_problem"
import { TaskTargetPosition } from "object_task/object_task_target_cache"
import { TargetingApiWrapper } from "object_task/targeting_api_wrapper"
import { V6Creep } from "prototype/creep"
import { HARVEST_RANGE } from "utility/constants"
import { bodyPower } from "utility/creep_body"
import { CreepApiWrapper, CreepApiWrapperProgress, CreepApiWrapperState } from "../creep_api_wrapper"

const apiWrapperType = "HarvestMineralApiWrapper"

export interface HarvestMineralApiWrapperState extends CreepApiWrapperState {
  /** type identifier */
  t: "HarvestMineralApiWrapper"

  /** mineral id */
  i: Id<Mineral>
}

export class HarvestMineralApiWrapper implements CreepApiWrapper, TargetingApiWrapper {
  public readonly shortDescription = "h-mineral"
  public readonly range = HARVEST_RANGE

  private constructor(
    public readonly target: Mineral,
  ) {
  }

  public encode(): HarvestMineralApiWrapperState {
    return {
      t: apiWrapperType,
      i: this.target.id,
    }
  }

  public static decode(state: HarvestMineralApiWrapperState): HarvestMineralApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new HarvestMineralApiWrapper(target)
  }

  public static create(target: Mineral): HarvestMineralApiWrapper {
    return new HarvestMineralApiWrapper(target)
  }

  public taskTarget(creep: V6Creep): TaskTargetPosition {
    return {
      taskTargetType: "position",
      position: this.target.pos,
      concreteTarget: this.target,
      taskType: "harvest",
      amount: bodyPower(creep.body, "harvest"),
    }
  }

  public run(creep: V6Creep): CreepApiWrapperProgress {
    const result = creep.harvest(this.target)

    switch (result) {
    case OK: {
      const harvestAmount = creep.body.filter(b => b.type === WORK).length * HARVEST_MINERAL_POWER
      if (creep.store.getFreeCapacity(this.target.mineralType) <= harvestAmount) {
        return CreepApiWrapperProgress.Finished(true)
      } else {
        return CreepApiWrapperProgress.InProgress(false)
      }
    }

    case ERR_TIRED:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NOT_IN_RANGE:
      return CreepApiWrapperProgress.InProgress(true)

    case ERR_NOT_ENOUGH_RESOURCES:
      return CreepApiWrapperProgress.InProgress(creep.pos.isNearTo(this.target.pos) !== true)

    case ERR_BUSY:
      return CreepApiWrapperProgress.InProgress(false)

    case ERR_NO_BODYPART:
      return CreepApiWrapperProgress.Failed(new CreepDamagedProblem(creep.memory.p, creep.room.name))

    case ERR_NOT_OWNER: // roomが他プレイヤーによりclaim/reserveされている場合
      return CreepApiWrapperProgress.Failed(new HarvestingRoomLostProblem(this.target))

    case ERR_NOT_FOUND:
      return CreepApiWrapperProgress.Failed(new MissingTargetStructureProblem(creep.memory.p, creep.room.name, STRUCTURE_EXTRACTOR, apiWrapperType))

    case ERR_INVALID_TARGET:
    default:
      return CreepApiWrapperProgress.Failed(new UnexpectedCreepProblem(creep.memory.p, creep.room.name, apiWrapperType, result))
    }
  }
}

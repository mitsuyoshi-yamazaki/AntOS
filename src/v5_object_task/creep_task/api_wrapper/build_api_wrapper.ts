import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { coloredText, roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { RoomPositionFilteringOptions } from "prototype/room_position"

type BuildApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

export interface BuildApiWrapperState extends CreepApiWrapperState {
  /** target id */
  i: Id<ConstructionSite<BuildableStructureConstant>>
}

export class BuildApiWrapper implements ApiWrapper<Creep, BuildApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "build"
  public readonly range = 1

  private constructor(
    public readonly target: ConstructionSite<BuildableStructureConstant>,
  ) { }

  public encode(): BuildApiWrapperState {
    return {
      t: "BuildApiWrapper",
      i: this.target.id,
    }
  }

  public static decode(state: BuildApiWrapperState): BuildApiWrapper | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new BuildApiWrapper(target)
  }

  public static create(target: ConstructionSite<BuildableStructureConstant>): BuildApiWrapper {
    return new BuildApiWrapper(target)
  }

  public run(creep: Creep): BuildApiWrapperResult {
    const result = creep.build(this.target)

    switch (result) {
    case OK: {
      const consumeAmount = creep.body.filter(b => b.type === WORK).length * BUILD_POWER
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= consumeAmount) {
        return FINISHED_AND_RAN
      }
      return IN_PROGRESS
    }

    case ERR_NOT_IN_RANGE:
      return ERR_NOT_IN_RANGE

    case ERR_NOT_ENOUGH_RESOURCES:
      return FINISHED

    case ERR_BUSY:
      return ERR_BUSY

    case ERR_NO_BODYPART:
      return ERR_DAMAGED

    case ERR_INVALID_TARGET: {
      const moveCreepResult = this.moveCreepAt(this.target.pos)
      if (moveCreepResult.creep != null) {
        PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} creep.build() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}, creep ${moveCreepResult.creep} moved`)
        return IN_PROGRESS
      }

      PrimitiveLogger.fatal(`creep.build() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }

    case ERR_NOT_OWNER:
    default:
      PrimitiveLogger.fatal(`creep.build() returns ${result}, ${creep.name}, construction site ${this.target} in ${roomLink(creep.room.name)}`)
      return ERR_PROGRAMMING_ERROR
    }
  }

  private moveCreepAt(position: RoomPosition): { creep: Creep | null } {
    const creep = position.findInRange(FIND_MY_CREEPS, 0)[0]
    if (creep == null) {
      return {
        creep: creep ?? null,
      }
    }
    const options: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeTerrainWalls: true,
      excludeWalkableStructures: false,
    }
    const emptyPosition = position.positionsInRange(1, options).find(neighbourPosition => {
      if (neighbourPosition.findInRange(FIND_CREEPS, 0).length > 0) {
        return false
      }
      return true
    })
    if (emptyPosition == null) {
      return {
        creep: creep ?? null,
      }
    }
    creep.moveTo(emptyPosition)
    return {
      creep,
    }
  }
}

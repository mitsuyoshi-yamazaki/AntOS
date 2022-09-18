import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { ApiWrapper } from "v5_object_task/api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import { coloredText, roomLink } from "utility/log"
import { CreepApiWrapperState } from "../creep_api_wrapper"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { GameConstants } from "utility/constants"

type BuildWallApiWrapperResult = FINISHED | FINISHED_AND_RAN | IN_PROGRESS | ERR_NOT_IN_RANGE | ERR_BUSY | ERR_DAMAGED | ERR_PROGRAMMING_ERROR

type TargetType = ConstructionSite<STRUCTURE_WALL> | ConstructionSite<STRUCTURE_RAMPART> | StructureWall | StructureRampart
const wallTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]

export interface BuildWallApiWrapperState extends CreepApiWrapperState {
  targetId: Id<TargetType>
  targetPosition: RoomPositionState
}

export class BuildWallApiWrapper implements ApiWrapper<Creep, BuildWallApiWrapperResult>, TargetingApiWrapper {
  public readonly shortDescription = "build"
  public readonly range = 1

  private constructor(
    public readonly target: TargetType,
  ) { }

  public encode(): BuildWallApiWrapperState {
    return {
      t: "BuildWallApiWrapper",
      targetId: this.target.id,
      targetPosition: this.target.pos.encode(),
    }
  }

  public static decode(state: BuildWallApiWrapperState): BuildWallApiWrapper | null {
    const targetPosition = decodeRoomPosition(state.targetPosition)
    const target = ((): TargetType | null => {
      const constructionSite = targetPosition.findInRange(FIND_CONSTRUCTION_SITES, 0)[0]
      if (constructionSite != null && wallTypes.includes(constructionSite.structureType)) {
        return constructionSite as ConstructionSite<STRUCTURE_WALL> | ConstructionSite<STRUCTURE_RAMPART>
      }
      const wall = targetPosition.findInRange(FIND_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } })[0]
      if (wall != null && wallTypes.includes(wall.structureType)) {
        return wall as StructureWall | StructureRampart
      }
      return null
    })()
    if (target == null) {
      return null
    }
    return new BuildWallApiWrapper(target)
  }

  public static create(target: ConstructionSite<STRUCTURE_WALL> | ConstructionSite<STRUCTURE_RAMPART>): BuildWallApiWrapper {
    return new BuildWallApiWrapper(target)
  }

  public run(creep: Creep): BuildWallApiWrapperResult {
    if (this.target instanceof ConstructionSite) {
      return this.build(creep, this.target)
    } else {
      return this.repair(creep, this.target)
    }
  }

  private build(creep: Creep, constructionSite: ConstructionSite): BuildWallApiWrapperResult {
    const result = creep.build(constructionSite)

    switch (result) {
    case OK: {
      const consumeAmount = creep.getActiveBodyparts(WORK) * GameConstants.creep.actionPower.build
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

  private repair(creep: Creep, wall: StructureWall | StructureRampart): BuildWallApiWrapperResult {
    const result = creep.repair(wall)

    switch (result) {
    case OK: {
      const consumeAmount = creep.getActiveBodyparts(WORK) * GameConstants.creep.actionPower.repair
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

    case ERR_INVALID_TARGET:
    case ERR_NOT_OWNER:
    default:
      PrimitiveLogger.fatal(`creep.repair() returns ${result}, ${creep.name}, structure: ${this.target} in ${roomLink(creep.room.name)}`)
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

import { TaskTarget } from "object_task/object_task_target_cache"
import { V6Creep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { BuildApiWrapper } from "../api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "../api_wrapper/repair_api_wrapper"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { MoveToTargetTask } from "./move_to_target_task"

type TargetType = ConstructionSite<STRUCTURE_WALL> | ConstructionSite<STRUCTURE_RAMPART> | StructureWall | StructureRampart
const wallTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]

export interface BuildWallTaskState extends CreepTaskState {
  /** type identifier */
  t: "BuildWallTask"

  targetId: Id<TargetType>
  targetPosition: RoomPositionState
}

export class BuildWallTask implements CreepTask {
  public readonly shortDescription = "build wall"
  private readonly targetPosition: RoomPosition

  private constructor(
    public readonly startTime: number,
    public readonly target: TargetType,
  ) {
    this.targetPosition = this.target.pos
  }

  public encode(): BuildWallTaskState {
    return {
      t: "BuildWallTask",
      s: this.startTime,
      targetId: this.target.id,
      targetPosition: this.targetPosition.encode()
    }
  }

  public static decode(state: BuildWallTaskState): BuildWallTask | null {
    const targetPosition = decodeRoomPosition(state.targetPosition)
    const target = ((): TargetType | null => {
      const constructionSite = targetPosition.findInRange(FIND_CONSTRUCTION_SITES, 0)[0]
      if (constructionSite != null && wallTypes.includes(constructionSite.structureType)) {
        return constructionSite as ConstructionSite<STRUCTURE_WALL> | ConstructionSite<STRUCTURE_RAMPART>
      }
      const wall = targetPosition.findInRange(FIND_STRUCTURES, 0)[0]
      if (wall != null && wallTypes.includes(wall.structureType)) {
        return wall as StructureWall | StructureRampart
      }
      return null
    })()
    if (target == null) {
      return null
    }
    return new BuildWallTask(state.s, target)
  }

  public static create(target: ConstructionSite<STRUCTURE_WALL> | ConstructionSite<STRUCTURE_RAMPART>): BuildWallTask {
    return new BuildWallTask(Game.time, target)
  }

  public taskTargets(creep: V6Creep): TaskTarget[] {
    return [this.apiWrapper().taskTarget(creep)]
  }

  public run(creep: V6Creep): CreepTaskProgress {
    return MoveToTargetTask.create(this.apiWrapper()).run(creep)
  }

  private apiWrapper(): BuildApiWrapper | RepairApiWrapper {
    if (this.target instanceof ConstructionSite) {
      return BuildApiWrapper.create(this.target)
    }
    return RepairApiWrapper.create(this.target)
  }
}

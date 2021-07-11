import { ProblemFinder } from "problem/problem_finder"
import { RoomName } from "utility/room_name"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "task/general/general_creep_worker_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { generateCodename } from "utility/unique_id"
import { MoveClaimControllerTask } from "object_task/creep_task/combined_task/move_claim_controller_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { EnergySource } from "prototype/room_object"
import { TRANSFER_RESOURCE_RANGE, UPGRADE_CONTROLLER_RANGE } from "utility/constants"

type UpgraderTaskEnergySource = StructureContainer | StructureLink

export interface UpgraderTaskState extends GeneralCreepWorkerTaskState {
  /** room name */
  r: RoomName

  /** upgrader positions */
  p: RoomPositionState[]
}

export class UpgraderTask extends GeneralCreepWorkerTask {
  public readonly taskIdentifier: TaskIdentifier

  private readonly codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    private readonly upgraderPositions: RoomPosition[],
  ) {
    super(startTime, children, roomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)
  }

  public encode(): UpgraderTaskState {
    return {
      t: "UpgraderTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      p: this.upgraderPositions.map(position => position.encode()),
    }
  }

  public static decode(state: UpgraderTaskState, children: Task[]): UpgraderTask {
    const upgraderPositions = state.p.map(positionState => decodeRoomPosition(positionState))
    return new UpgraderTask(state.s, children, state.r, upgraderPositions)
  }

  public static create(roomName: RoomName): UpgraderTask {
    const upgraderPositions: RoomPosition[] = []
    const objects = World.rooms.getOwnedRoomObjects(roomName)
    if (objects != null) {
      const controller = objects.controller
      const container = controller.pos.findInRange(FIND_STRUCTURES, UPGRADE_CONTROLLER_RANGE).find(structure => structure.structureType === STRUCTURE_CONTAINER) as StructureContainer | null
      const link = controller.pos.findInRange(FIND_STRUCTURES, UPGRADE_CONTROLLER_RANGE).find(structure => structure.structureType === STRUCTURE_LINK) as StructureLink | null
      objects.roomInfo.upgrader = {
        container,
        link,
      }

      const options: RoomPositionFilteringOptions = {
        excludeItself: true,
        excludeTerrainWalls: true,
        excludeStructures: true,
        excludeWalkableStructures: false,
      }
      const positions = controller.pos.positionsInRange(UPGRADE_CONTROLLER_RANGE, options)
        .filter(position => {
          if (container == null) {
            return true
          }
          return position.getRangeTo(container.pos) <= TRANSFER_RESOURCE_RANGE
        })
      upgraderPositions.push(...positions)
    }

    return new UpgraderTask(Game.time, [], roomName, upgraderPositions)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    super.runTask(objects, childTaskResults)

    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  public creepFileter(): CreepPoolFilter {
    return (creep => hasNecessaryRoles(creep, [CreepRole.Claimer])) // TODO:
  }

  public creepRequest(): GeneralCreepWorkerTaskCreepRequest | null {
    return null
    // return {
    //   necessaryRoles: [CreepRole.Claimer],
    //   taskIdentifier: this.taskIdentifier,
    //   numberOfCreeps: 1,
    //   codename: this.codename,
    //   initialTask: creepTask,
    //   priority: CreepSpawnRequestPriority.Medium,
    //   body: null
    // }
  }

  public newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    return null
  }
}

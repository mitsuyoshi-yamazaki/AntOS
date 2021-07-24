import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProblemFinder } from "v5_problem/problem_finder"
import { CreepRole, hasSomeRoles } from "prototype/creep_role"
import { RoomName } from "utility/room_name"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { OwnedRoomObjects } from "world_info/room_info"
import { World } from "world_info/world_info"
import { TaskState } from "v5_task/task_state"
import { roomLink } from "utility/log"

export interface BuildContainerTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target position */
  p: RoomPositionState

  /** builder creep task identifier */
  ct: TaskIdentifier

  /** construction site id */
  ci: Id<ConstructionSite<STRUCTURE_CONTAINER>> | null
}

/**
 * - Owned structureを建てる場合は勝手が異なるのでBuildOwnedStructureTaskを用いる
 * - Creepは親と共有する（子が先にタスクを割り当てるのでうまく動くはず
 * - Roomが見えていないと動作しない：現状では親に期待する // TODO:
 */
export class BuildContainerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier
  public get container(): StructureContainer | null {
    return this.targetPosition.lookFor(LOOK_STRUCTURES).filter(structure => structure instanceof StructureContainer)[0] as StructureContainer | null
  }

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetPosition: RoomPosition,
    private readonly builderCreepIdentifier: TaskIdentifier,
    private constructionSiteId: Id<ConstructionSite<STRUCTURE_CONTAINER>> | null,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): BuildContainerTaskState {
    return {
      t: "BuildContainerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      p: this.targetPosition.encode(),
      ct: this.builderCreepIdentifier,
      ci: this.constructionSiteId,
    }
  }

  public static decode(state: BuildContainerTaskState, children: Task[]): BuildContainerTask {
    const targetPosition = decodeRoomPosition(state.p)
    return new BuildContainerTask(state.s, children, state.r, targetPosition, state.ct, state.ci)
  }

  public static create(roomName: RoomName, targetPosition: RoomPosition, builderCreepIdentifier: TaskIdentifier): BuildContainerTask {
    return new BuildContainerTask(Game.time, [], roomName, targetPosition, builderCreepIdentifier, null)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    if (this.container != null) {
      return TaskStatus.Finished
    }

    const targetRoom = World.rooms.get(this.targetPosition.roomName)
    if (targetRoom == null) {
      return TaskStatus.InProgress  // visibilityは親タスクに期待する
    }

    const constructionSite = ((): ConstructionSite<STRUCTURE_CONTAINER> | null => {
      if (this.constructionSiteId == null) {
        return null
      }
      const site = Game.getObjectById(this.constructionSiteId)
      if (site == null) {
        this.constructionSiteId = null
        return null
      }
      return site
    })()

    if (constructionSite == null) {
      this.createConstructionSite(targetRoom)
      return TaskStatus.InProgress
    }

    this.buildContainer(objects, constructionSite)

    const problemFinders: ProblemFinder[] = []
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  // ---- Build ---- //
  private buildContainer(objects: OwnedRoomObjects, constructionSite: ConstructionSite<STRUCTURE_CONTAINER>): void {
    const requiredRoles: CreepRole[] = [CreepRole.Harvester, CreepRole.Worker]
    const creepPoolFilter: CreepPoolFilter = creep => hasSomeRoles(creep, requiredRoles)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      this.builderCreepIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskForBuilder(creep, constructionSite)
      },
      creepPoolFilter,
    )
  }

  private newTaskForBuilder(creep: Creep, constructionSite: ConstructionSite<STRUCTURE_CONTAINER>): CreepTask | null {
    if (creep.room.name !== this.targetPosition.roomName) {
      return MoveToRoomTask.create(this.targetPosition.roomName, [])
    }

    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const source = creep.pos.findClosestByPath(FIND_SOURCES)
      if (source != null) {
        return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
      }
      creep.say("no source")
      return null
    }
    return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
  }

  // ---- Create Construction Site ---- //
  private createConstructionSite(targetRoom: Room): void {
    const result = targetRoom.createConstructionSite(this.targetPosition, STRUCTURE_CONTAINER)
    switch (result) {
    case OK:
      return

    case ERR_INVALID_TARGET: {
      const constructionSite = this.targetPosition.lookFor(LOOK_CONSTRUCTION_SITES)[0]
      if (constructionSite != null && constructionSite.structureType === STRUCTURE_CONTAINER) {
        this.constructionSiteId = constructionSite.id as Id<ConstructionSite<STRUCTURE_CONTAINER>>
        return
      }
      PrimitiveLogger.fatal(`createConstructionSite returns ERR_INVALID_TARGET ${this.taskIdentifier}`)
      return
    }
    case ERR_NOT_OWNER:
    case ERR_FULL:
    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
      if ((Game.time % 19) === 5) {
        PrimitiveLogger.fatal(`createConstructionSite failed ${this.taskIdentifier}, ${result} in ${roomLink(targetRoom.name)}`)
      }
      return
    }
    return
  }
}

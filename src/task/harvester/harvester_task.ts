import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveHarvestEnergyTask } from "object_task/creep_task/combined_task/move_harvest_energy_task"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"

const creepCountForSource = 6

export interface HarvesterTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** source id */
  i: Id<Source>
}

export class HarvesterTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly sourceId: Id<Source>,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.sourceId}`
  }

  public encode(): HarvesterTaskState {
    return {
      t: "HarvesterTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      i: this.sourceId,
    }
  }

  public static decode(state: HarvesterTaskState): HarvesterTask {
    const children = decodeTasksFrom(state.c)
    return new HarvesterTask(state.s, children, state.r, state.i)
  }

  public static create(roomName: RoomName, sourceId: Id<Source>): HarvesterTask {
    return new HarvesterTask(Game.time, [], roomName, sourceId)
  }

  public description(): string {
    return this.taskIdentifier
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {


    // const roomName = objects.controller.room.name
    // const necessaryRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover]
    // const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    // const minimumCreepCount = creepCountForSource * objects.sources.length
    // const filterTaskIdentifier = null
    // const creepInsufficiencyProblemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, filterTaskIdentifier, minimumCreepCount)
    // if (creepInsufficiencyProblemFinder.problemExists() && this.isSolvingProblem(creepInsufficiencyProblemFinder.identifier) !== true) {
    //   const solver = creepInsufficiencyProblemFinder.getProblemSolvers()[0]
    //   if (solver instanceof CreepInsufficiencyProblemSolver) {
    //     solver.codename = generateCodename(this.constructor.name, this.roomName.split("").reduce((r, c) => r + c.charCodeAt(0), 0))
    //   }
    //   if (solver != null) {
    //     this.addChildTask(solver)
    //   }
    // }

    // World.resourcePools.assignTasks(
    //   objects.controller.room.name,
    //   filterTaskIdentifier,
    //   CreepPoolAssignPriority.Low,
    //   (creep: Creep): CreepTask | null => {
    //     return this.newTaskFor(creep, objects)
    //   },
    //   creepPoolFilter,
    // )

    return TaskStatus.InProgress
  }

  // ---- Private ---- //
  private newTaskForHarvester(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const source = objects.getSource(creep.pos)
      if (source == null) {
        return null
      }
      return MoveHarvestEnergyTask.create(source)
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    const damagedStructure = objects.getRepairStructure()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
    }
    const constructionSite = objects.getConstructionSite()
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller))
  }

  private newTaskForHauler(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const source = objects.getSource(creep.pos)
      if (source == null) {
        return null
      }
      return MoveHarvestEnergyTask.create(source)
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    const damagedStructure = objects.getRepairStructure()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
    }
    const constructionSite = objects.getConstructionSite()
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller))
  }
}

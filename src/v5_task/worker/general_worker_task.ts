import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { BuildApiWrapper } from "object_task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "v5_problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "v5_task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { GetEnergyApiWrapper } from "object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { ProblemFinder } from "v5_problem/problem_finder"
import { HarvestEnergyApiWrapper } from "object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { TaskState } from "v5_task/task_state"
import { bodyCost } from "utility/creep_body"

export interface GeneralWorkerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

/**
 * - build, upgradeを行う
 */
export class GeneralWorkerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): GeneralWorkerTaskState {
    return {
      t: "GeneralWorkerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: GeneralWorkerTaskState, children: Task[]): GeneralWorkerTask {
    return new GeneralWorkerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName): GeneralWorkerTask {
    return new GeneralWorkerTask(Game.time, [], roomName)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const roles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover, CreepRole.Hauler]
    const filterTaskIdentifier = null
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, [CreepRole.Worker, CreepRole.Mover])

    const problemFinders: ProblemFinder[] = [
      this.createCreepInsufficiencyProblemFinder(objects, roles, filterTaskIdentifier)
    ]

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskFor(creep, objects)
      },
      creepPoolFilter,
    )

    return TaskStatus.InProgress
  }

  // ---- Problem Solver ---- //
  private createCreepInsufficiencyProblemFinder(objects: OwnedRoomObjects, roles: CreepRole[], filterTaskIdentifier: TaskIdentifier | null): ProblemFinder {
    const roomName = objects.controller.room.name
    const minimumCreepCount = ((): number => {
      if (objects.activeStructures.storage == null) {
        return 5
      }
      const energy = objects.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY)
      return Math.min(Math.max(Math.floor(energy / 10000), 3), 5)
    })()
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, roles, roles, filterTaskIdentifier, minimumCreepCount)

    const noCreeps = problemFinder.creepCount <= 2
    const body = noCreeps ? [CARRY, WORK, MOVE] : this.workerBody(objects)
    const priority = noCreeps ? CreepSpawnRequestPriority.Urgent : CreepSpawnRequestPriority.Medium

    const problemFinderWrapper: ProblemFinder = {
      identifier: problemFinder.identifier,
      problemExists: () => problemFinder.problemExists(),
      getProblemSolvers: () => {
        const solver = problemFinder.getProblemSolvers()[0] // TODO: 選定する
        if (solver instanceof CreepInsufficiencyProblemSolver) {
          solver.codename = generateCodename(this.constructor.name, this.startTime)
          solver.priority = priority
          solver.body = body
        }
        if (solver != null) {
          this.addChildTask(solver)
        }
        return [solver]
      },
    }

    return problemFinderWrapper
  }

  private workerBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    const maximumCarryUnitCount = 3 // TODO: 算出する
    const unit: BodyPartConstant[] = [CARRY, CARRY, WORK, WORK, MOVE]

    const constructBody = ((unitCount: number): BodyPartConstant[] => {
      const result: BodyPartConstant[] = []
      for (let i = 0; i < unitCount; i += 1) {
        result.push(...unit)
      }
      return result
    })

    const energyCapacity = objects.controller.room.energyCapacityAvailable
    for (let i = maximumCarryUnitCount; i >= 1; i -= 1) {
      const body = constructBody(i)
      const cost = bodyCost(body)
      if (cost <= energyCapacity) {
        return body
      }
    }
    return [WORK, CARRY, MOVE]
  }

  // ---- Creep Task ---- //
  private newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const energyStore = objects.getEnergyStore(creep.pos)
      if (energyStore != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(energyStore))
      }

      const source = objects.getSource(creep.pos)
      if (source != null) {
        return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
      }

      creep.say("no task")
      return null
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

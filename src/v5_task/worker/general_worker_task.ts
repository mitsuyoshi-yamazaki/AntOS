import type { RoomName } from "shared/utility/room_name_types"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "v5_object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "v5_problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "v5_task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { ProblemFinder } from "v5_problem/problem_finder"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { TaskState } from "v5_task/task_state"
import { bodyCost } from "utility/creep_body"
import { TempRenewApiWrapper } from "v5_object_task/creep_task/api_wrapper/temp_renew_api_wrapper"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"

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
    const filterTaskIdentifier = null

    const problemFinders: ProblemFinder[] = [
      this.createCreepInsufficiencyProblemFinder(objects, filterTaskIdentifier)
    ]

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        const task = this.newTaskFor(creep, objects)
        if (task == null) {
          return null
        }
        return FleeFromAttackerTask.create(task)
      },
    )

    return TaskStatus.InProgress
  }

  // ---- Problem Solver ---- //
  private createCreepInsufficiencyProblemFinder(objects: OwnedRoomObjects, filterTaskIdentifier: TaskIdentifier | null): ProblemFinder {
    const room = objects.controller.room
    const roomName = room.name
    const minimumCreepCount = ((): number => {
      if (objects.activeStructures.storage == null) {
        return 5
      }
      const energy = objects.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY)
      return Math.min(Math.max(Math.floor(energy / 10000), 3), 5)
    })()
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, null, [], filterTaskIdentifier, minimumCreepCount)

    const noCreeps = problemFinder.creepCount < 2
    const energyCapacity = noCreeps === true ? room.energyAvailable : room.energyCapacityAvailable
    const body = this.workerBody(energyCapacity)
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
          return [solver]
        }
        return []
      },
    }

    return problemFinderWrapper
  }

  private workerBody(energyCapacity: number): BodyPartConstant[] {
    const maximumCarryUnitCount = 6 // TODO: 算出する
    const unit: BodyPartConstant[] = [CARRY, WORK, MOVE]

    const constructBody = ((unitCount: number): BodyPartConstant[] => {
      const result: BodyPartConstant[] = []
      for (let i = 0; i < unitCount; i += 1) {
        result.push(...unit)
      }
      return result
    })

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
      if (creep.ticksToLive != null && creep.ticksToLive < 400) {
        const spawn = objects.activeStructures.spawns[0]
        const room = objects.controller.room
        if (spawn != null && room.energyAvailable > 150) {
          const cost = bodyCost(creep.body.map(b => b.type))
          if (cost > room.energyCapacityAvailable) {
            return MoveToTargetTask.create(TempRenewApiWrapper.create(spawn))
          }
        }
      }

      const energyStore = objects.getEnergyStore(creep.pos)
      if (energyStore != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(energyStore))
      }

      const source = objects.getSource(creep.pos)
      if (source != null) {
        return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source), { reusePath: 3, ignoreSwamp: false })
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
    const constructionSite = objects.getConstructionSite(creep.pos)
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller), { reusePath: 3, ignoreSwamp: false })
  }
}

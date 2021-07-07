import { RoomName } from "prototype/room"
import { Task, TaskIdentifier, TaskState, TaskStatus } from "task/task"
import { decodeTasksFrom } from "task/task_decoder"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { TransferEnergyApiWrapper } from "object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { MoveToTargetTask } from "object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { ProblemFinder } from "problem/problem_finder"
import { GetEnergyApiWrapper } from "object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { OwnedRoomEnergySourceTask } from "./owned_room_energy_source_task"
import { EnergySource, EnergyStore } from "prototype/room_object"

export interface OwnedRoomHaulerTaskState extends TaskState {
  /** room name */
  r: RoomName
}

export class OwnedRoomHaulerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private get energySources(): OwnedRoomEnergySourceTask[] {
    return this.children.filter(task => task instanceof OwnedRoomEnergySourceTask) as OwnedRoomEnergySourceTask[]
  }

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): OwnedRoomHaulerTaskState {
    return {
      t: "OwnedRoomHaulerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: OwnedRoomHaulerTaskState): OwnedRoomHaulerTask | null {
    const children = decodeTasksFrom(state.c)
    return new OwnedRoomHaulerTask(state.s, children, state.r)
  }

  public static create(roomName: RoomName, energySources: OwnedRoomEnergySourceTask[]): OwnedRoomHaulerTask {
    return new OwnedRoomHaulerTask(Game.time, energySources, roomName)
  }

  public description(): string {
    return this.taskIdentifier
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const energySources = this.energySources.flatMap(source => source.energySources)
    const problemFinders: ProblemFinder[] = []
    problemFinders.push(...this.runHauler(objects, energySources))

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private runHauler(objects: OwnedRoomObjects, energySources: EnergySource[]): ProblemFinder[] {
    const necessaryRoles: CreepRole[] = [CreepRole.Hauler, CreepRole.Mover, CreepRole.EnergyStore]
    const filterTaskIdentifier = null
    const minimumCreepCount = energySources.length * 2 // TODO: 距離等を加味する
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
      this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, filterTaskIdentifier, minimumCreepCount, null, CreepSpawnRequestPriority.Medium)
    ]

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskForHauler(creep, objects, energySources)
      },
      creepPoolFilter,
    )

    return problemFinders
  }

  private createCreepInsufficiencyProblemFinder(
    objects: OwnedRoomObjects,
    necessaryRoles: CreepRole[],
    filterTaskIdentifier: TaskIdentifier | null,
    minimumCreepCount: number,
    initialTask: (() => CreepTask) | null,
    priority: CreepSpawnRequestPriority,
  ): ProblemFinder {
    const roomName = objects.controller.room.name
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, filterTaskIdentifier, minimumCreepCount)

    const problemFinderWrapper: ProblemFinder = {
      identifier: problemFinder.identifier,
      problemExists: () => problemFinder.problemExists(),
      getProblemSolvers: () => {
        const solver = problemFinder.getProblemSolvers()[0] // TODO: 選定する
        if (solver instanceof CreepInsufficiencyProblemSolver) {
          solver.codename = generateCodename(this.constructor.name, this.startTime)
          solver.initialTask = initialTask != null ? initialTask() : null
          solver.priority = priority
        }
        if (solver != null) {
          this.addChildTask(solver)
        }
        return [solver]
      },
    }

    return problemFinderWrapper
  }

  // ---- Creep Task ---- //
  private newTaskForHauler(creep: Creep, objects: OwnedRoomObjects, energySources: EnergySource[]): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const energySource = this.getEnergySource(creep.pos, objects, energySources)
      if (energySource != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(energySource))
      }
      creep.say("no source")
      return null
    }

    if (objects.activeStructures.storage != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(objects.activeStructures.storage))
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }
    creep.say("no storage")
    return null
  }

  private getEnergySource(position: RoomPosition, objects: OwnedRoomObjects, energySources: EnergySource[]): EnergyStore | null {
    const availableEnergyStores = energySources.filter(source => {
      if (source.targetedBy.length >= 2) {
        return false
      }
      if (source instanceof Resource) {
        return source.resourceType === RESOURCE_ENERGY && source.amount >= 100
      }
      return source.store.getUsedCapacity(RESOURCE_ENERGY) >= 100
    })
    if (availableEnergyStores.length > 0) {
      return availableEnergyStores.reduce((lhs, rhs) => {
        const lTargetedBy = lhs.targetedBy.length
        const rTargetedBy = rhs.targetedBy.length
        if (lTargetedBy === rTargetedBy) {
          return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
        }
        return lTargetedBy < rTargetedBy ? lhs : rhs
      })
    }

    return objects.getEnergySource(position)
  }
}

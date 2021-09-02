import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "v5_problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "v5_task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { ProblemFinder } from "v5_problem/problem_finder"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { EnergySourceTask } from "./owned_room_energy_source_task"
import { EnergySource, EnergyStore, getEnergyAmountOf } from "prototype/room_object"
import { MoveToTransferHaulerTask } from "v5_object_task/creep_task/combined_task/move_to_transfer_hauler_task"
import { TaskState } from "v5_task/task_state"
import { bodyCost } from "utility/creep_body"
import { GameConstants } from "utility/constants"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"

export interface OwnedRoomHaulerTaskState extends TaskState {
  /** room name */
  r: RoomName

  storageDistance: number | null
}

export class OwnedRoomHaulerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private get energySources(): EnergySourceTask[] {
    return this.children.filter(task => task instanceof EnergySourceTask) as EnergySourceTask[]
  }

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    private storageDistance: number | null,
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
      storageDistance: this.storageDistance,
    }
  }

  public static decode(state: OwnedRoomHaulerTaskState, children: Task[]): OwnedRoomHaulerTask | null {
    return new OwnedRoomHaulerTask(state.s, children, state.r, state.storageDistance)
  }

  public static create(roomName: RoomName, energySources: EnergySourceTask[]): OwnedRoomHaulerTask {
    return new OwnedRoomHaulerTask(Game.time, energySources, roomName, null)
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
    const filterTaskIdentifier = this.taskIdentifier
    const energyCapacity = objects.sources.reduce((result, current) => result + current.energyCapacity, 0)
    const minimumCreepCount = ((): number => {
      const baseCount = Math.ceil(energyCapacity / 3000)
      if (this.storageDistance == null) {
        const storage = objects.activeStructures.storage
        if (storage == null) {
          return baseCount
        }
        this.storageDistance = objects.sources.reduce((result, current) => result + current.pos.getRangeTo(storage.pos), 0)
      }
      const countBasedOnDistance = Math.ceil((baseCount / 2) * (this.storageDistance / 10)) * 0.8
      return Math.max(countBasedOnDistance, baseCount)
    })()
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
    ]

    if (objects.activeStructures.storage != null) {
      const problemFinder = this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, filterTaskIdentifier, minimumCreepCount, null, CreepSpawnRequestPriority.Medium)
      problemFinders.push(problemFinder)
    }

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
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, necessaryRoles, filterTaskIdentifier, minimumCreepCount)

    const problemFinderWrapper: ProblemFinder = {
      identifier: problemFinder.identifier,
      problemExists: () => problemFinder.problemExists(),
      getProblemSolvers: () => {
        const solver = problemFinder.getProblemSolvers()[0] // TODO: 選定する
        if (solver instanceof CreepInsufficiencyProblemSolver) {
          solver.codename = generateCodename(this.constructor.name, this.startTime)
          solver.initialTask = initialTask != null ? initialTask() : null
          solver.priority = priority
          solver.body = this.haulerBody(objects)
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

  private haulerBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    const sourceCapacity = ((): number => {
      let result = 0

      objects.sources.forEach((source: Source): void => {
        result += source.energyCapacity
        const effects = source.effects
        if (effects == null) {
          return
        }
        const regenEffect = effects.find(effect => effect.effect === PWR_REGEN_SOURCE) as PowerEffect | null
        if (regenEffect == null) {
          return
        }
        const powerConstant = GameConstants.power.regenSource
        const value = powerConstant.value[regenEffect.level]
        if (value == null) {
          PrimitiveLogger.programError(`Source ${source.id} in ${roomLink(source.room.name)} has effect with unimplemented level ${regenEffect.level}`)
          return
        }
        result += (GameConstants.source.regenerationDuration / GameConstants.power.regenSource.duration) * value
      })
      return result
    })()

    const maximumCarryUnitCount = Math.floor(sourceCapacity / 1500)
    const unit: BodyPartConstant[] = [CARRY, CARRY, MOVE]

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
    return constructBody(1)
  }

  // ---- Creep Task ---- //
  private newTaskForHauler(creep: Creep, objects: OwnedRoomObjects, energySources: EnergySource[]): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      if (creep.store.getFreeCapacity() > 0) {
        const hasResource = creep.store.getUsedCapacity() > 0
        const resourcefulTombstones = objects.tombStones.filter(tomb => {
          const amount = tomb.store.getUsedCapacity()
          if (amount <= 0) {
            return false
          }
          if (hasResource !== true) {
            return true
          }
          if (amount !== tomb.store.getUsedCapacity(RESOURCE_ENERGY)) {
            return true
          }
          return false
        })
        const resourcefulTombstone = creep.pos.findClosestByRange(resourcefulTombstones)
        if (resourcefulTombstone != null) {
          const resourceTypes = Object.keys(resourcefulTombstone.store) as ResourceConstant[]
          const mineral = resourceTypes.filter(resourceType => resourceType !== RESOURCE_ENERGY)[0]

          if (mineral != null) {
            return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(resourcefulTombstone, mineral))
          }
          if (resourceTypes.includes(RESOURCE_ENERGY) === true) {
            return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(resourcefulTombstone, RESOURCE_ENERGY))
          }
        }

        const droppedResource = objects.droppedResources.filter(resource => {
          if (resource.resourceType !== RESOURCE_ENERGY) {
            return true
          }
          if (hasResource === true) {
            return false
          }
          return resource.amount > 100
        })[0]
        if (droppedResource != null) {
          return MoveToTargetTask.create(PickupApiWrapper.create(droppedResource))
        }
      }

      if (creep.store.getUsedCapacity() > 0) {
        const resourceType = Object.keys(creep.store)[0] as ResourceConstant | null
        const storageObject = objects.activeStructures.terminal ?? objects.activeStructures.storage
        if (resourceType != null && storageObject != null) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(storageObject, resourceType))
        }
      }

      const energySource = this.getEnergySource(creep.pos, objects, energySources)
      if (energySource != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(energySource))
      }
      creep.say("no source")
      return null
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTransferHaulerTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    if (objects.activeStructures.storage != null) {
      return MoveToTransferHaulerTask.create(TransferEnergyApiWrapper.create(objects.activeStructures.storage))
    }

    creep.say("no storage")
    return null
  }

  private getEnergySource(position: RoomPosition, objects: OwnedRoomObjects, energySources: EnergySource[]): EnergyStore | null {
    const droppedEnergy = objects.droppedResources.find(resource => {
      if (resource.v5TargetedBy.length > 0) {
        return false
      }
      if (resource.resourceType !== RESOURCE_ENERGY) {  // TODO: その他のリソースも回収する
        return false
      }
      return resource.amount >= 100
    })
    if (droppedEnergy != null) {
      return droppedEnergy
    }

    const tombstone = objects.tombStones.find(tombstone => {
      if (tombstone.v5TargetedBy.length > 0) {
        return false
      }
      return tombstone.store.getUsedCapacity(RESOURCE_ENERGY) >= 100  // TODO: その他のリソースも回収する
    })
    if (tombstone != null) {
      return tombstone
    }

    const availableEnergyStores = energySources.filter(source => {
      if (source.v5TargetedBy.length >= 2) {
        return false
      }
      if (source instanceof Resource) {
        return source.resourceType === RESOURCE_ENERGY && source.amount >= 100
      }
      return source.store.getUsedCapacity(RESOURCE_ENERGY) >= 100
    })
    if (availableEnergyStores.length > 0) {
      return availableEnergyStores.reduce((lhs, rhs) => {
        const lTargetedBy = lhs.v5TargetedBy.length
        const rTargetedBy = rhs.v5TargetedBy.length
        if (lTargetedBy === rTargetedBy) {
          return getEnergyAmountOf(lhs) > getEnergyAmountOf(rhs) ? lhs : rhs
        }
        return lTargetedBy < rTargetedBy ? lhs : rhs
      })
    }

    return objects.getEnergySource(position)
  }
}

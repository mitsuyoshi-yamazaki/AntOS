import { RoomName } from "utility/room_name"
import { Task, TaskIdentifier, TaskStatus } from "task/task"
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
import { bodyCost } from "world_info/resource_pool/creep_specs"
import { EnergySource, EnergyStore, getEnergyAmountOf } from "prototype/room_object"
import { MoveToTransferHaulerTask } from "object_task/creep_task/combined_task/move_to_transfer_hauler_task"
import { TaskState } from "task/task_state"
import { MoveToRoomTask } from "object_task/creep_task/meta_task/move_to_room_task"
import { EnergySourceTask } from "task/hauler/owned_room_energy_source_task"

export interface RemoteRoomHaulerTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName
}

export class RemoteRoomHaulerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private get energySources(): EnergySourceTask[] {
    return this.children.filter(task => task instanceof EnergySourceTask) as EnergySourceTask[]
  }

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
  }

  public encode(): RemoteRoomHaulerTaskState {
    return {
      t: "RemoteRoomHaulerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName
    }
  }

  public static decode(state: RemoteRoomHaulerTaskState, children: Task[]): RemoteRoomHaulerTask | null {
    return new RemoteRoomHaulerTask(state.s, children, state.r, state.tr)
  }

  public static create(roomName: RoomName, targetRoomName: RoomName, energySources: EnergySourceTask[]): RemoteRoomHaulerTask {
    return new RemoteRoomHaulerTask(Game.time, energySources, roomName, targetRoomName)
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
    const minimumCreepCount = energySources.length * 3 // TODO: 距離等を加味する
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
      this.createCreepInsufficiencyProblemFinder(objects, filterTaskIdentifier, necessaryRoles, minimumCreepCount)
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
    filterTaskIdentifier: TaskIdentifier,
    necessaryRoles: CreepRole[],
    minimumCreepCount: number,
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
          solver.body = this.haulerBody(objects)
        }
        if (solver != null) {
          this.addChildTask(solver)
        }
        return [solver]
      },
    }

    return problemFinderWrapper
  }

  private haulerBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    const maximumCarryUnitCount = 5 // TODO: 算出する
    const unit: BodyPartConstant[] = [CARRY, CARRY, MOVE]

    const constructBody = ((unitCount: number): BodyPartConstant[] => {
      const result: BodyPartConstant[] = [WORK, CARRY, MOVE]
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
    return unit
  }

  // ---- Creep Task ---- //
  private newTaskForHauler(creep: Creep, objects: OwnedRoomObjects, energySources: EnergySource[]): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const energySource = this.getEnergySource(energySources)
      if (energySource != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(energySource))
      }
      creep.say("no source")
      return MoveToRoomTask.create(this.targetRoomName, [])
    }

    if (objects.activeStructures.storage != null) {
      return MoveToTransferHaulerTask.create(TransferEnergyApiWrapper.create(objects.activeStructures.storage)) // TODO: repair
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTransferHaulerTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }
    creep.say("no storage")
    return null
  }

  private getEnergySource(energySources: EnergySource[]): EnergyStore | null {
    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom != null) {
      const droppedEnergy = targetRoom.find(FIND_DROPPED_RESOURCES).find(resource => {
        if (resource.targetedBy.length > 0) {
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

      // const tombstone = objects.tombStones.find(tombstone => { // TODO:
      //   if (tombstone.targetedBy.length > 0) {
      //     return false
      //   }
      //   return tombstone.store.getUsedCapacity(RESOURCE_ENERGY) >= 100  // TODO: その他のリソースも回収する
      // })
      // if (tombstone != null) {
      //   return tombstone
      // }
    }

    if (energySources.length > 0) {
      return energySources.reduce((lhs, rhs) => {
        const lTargetedBy = lhs.targetedBy.length
        const rTargetedBy = rhs.targetedBy.length
        if (lTargetedBy === rTargetedBy) {
          return getEnergyAmountOf(lhs) > getEnergyAmountOf(rhs) ? lhs : rhs
        }
        return lTargetedBy < rTargetedBy ? lhs : rhs
      })
    }
    return null
  }
}

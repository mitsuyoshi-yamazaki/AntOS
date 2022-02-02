import { RoomName, roomTypeOf } from "utility/room_name"
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
import { bodyCost } from "utility/creep_body"
import { EnergySource, EnergyStore, getEnergyAmountOf, getResourceAmountOf } from "prototype/room_object"
import { MoveToTransferHaulerTask } from "v5_object_task/creep_task/combined_task/move_to_transfer_hauler_task"
import { TaskState } from "v5_task/task_state"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { EnergySourceTask } from "v5_task/hauler/owned_room_energy_source_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { DropResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"
import { FleeFromSKLairTask } from "v5_object_task/creep_task/combined_task/flee_from_sk_lair_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { GclFarmDeliverTarget, GclFarmResources } from "room_resource/gcl_farm_resources"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { decodeRoomPosition } from "prototype/room_position"

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
    const problemFinders: ProblemFinder[] = []
    problemFinders.push(...this.runHauler(objects))

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private runHauler(objects: OwnedRoomObjects): ProblemFinder[] {
    const energySources = this.energySources.flatMap(source => source.energySources)
    const energyCapacity = this.energySources.reduce((result, current) => result + current.energyCapacity, 0)

    const necessaryRoles: CreepRole[] = [CreepRole.Hauler, CreepRole.Mover, CreepRole.EnergyStore]
    const filterTaskIdentifier = this.taskIdentifier
    const minimumCreepCount = Math.ceil(energyCapacity / 2000) // TODO: 距離等を加味する
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
    ]

    if (objects.activeStructures.storage != null) {
      const hasEnergy = energySources.some(source => getEnergyAmountOf(source) > 500)
      if (hasEnergy === true) {
        const targetRoom = World.rooms.get(this.targetRoomName)
        if (targetRoom != null) {
          const invaded = targetRoom.find(FIND_HOSTILE_CREEPS).some(creep => (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0))
          if (invaded !== true) {
            problemFinders.push(this.createCreepInsufficiencyProblemFinder(objects, filterTaskIdentifier, necessaryRoles, minimumCreepCount))
          }
        }
      }
    }

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        const task = this.newTaskForHauler(creep, objects, energySources)
        if (task == null) {
          return null
        }
        if (roomTypeOf(this.roomName) === "source_keeper") {
          return FleeFromSKLairTask.create(task)
        }
        return FleeFromAttackerTask.create(task, 6, { failOnFlee: true })
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
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, necessaryRoles, filterTaskIdentifier, minimumCreepCount)

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
          return [solver]
        }
        return []
      },
    }

    return problemFinderWrapper
  }

  private haulerBody(objects: OwnedRoomObjects): BodyPartConstant[] {
    const maximumCarryUnitCount = 10 // TODO: 算出する
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
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
        const powerStorage = objects.activeStructures.terminal ?? objects.activeStructures.storage
        if (powerStorage != null) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(powerStorage, RESOURCE_POWER))
        }
      } else {
        const targetRoom = Game.rooms[this.targetRoomName]
        if (targetRoom != null) {
          const droppedPower = targetRoom.find(FIND_DROPPED_RESOURCES)
            .filter(resource => getResourceAmountOf(resource, RESOURCE_POWER))
            .sort((lhs, rhs) => {
              return lhs.amount - rhs.amount
            })[0]
          if (droppedPower != null) {
            return MoveToTargetTask.create(PickupApiWrapper.create(droppedPower))
          }

          const tombstone = targetRoom.find(FIND_TOMBSTONES)
            .filter(tombstone => getResourceAmountOf(tombstone, RESOURCE_POWER))[0]
          if (tombstone != null) {
            return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(tombstone, RESOURCE_POWER))
          }
        }
      }
      const energySource = this.getEnergySource(energySources)
      if (energySource != null) {
        if (this.targetRoomName === "W8S24" && creep.room.name === "W9S24") {
          return MoveToTask.create(new RoomPosition(49, 19, creep.room.name), 0)
        }
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(energySource))
      }
      creep.say("no source")
      return MoveToRoomTask.create(this.targetRoomName, [])
    }

    if (creep.store.getFreeCapacity() > 0) {
      const container = creep.pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_CONTAINER } })[0] as StructureContainer | null
      if (container != null && container.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        return RunApiTask.create(WithdrawResourceApiWrapper.create(container, RESOURCE_ENERGY))
      }
    }

    const gclFarmInfo = GclFarmResources.getFarmInfo(this.targetRoomName)
    if (gclFarmInfo != null && creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {  // energy以外のresourceを拾っている場合を除外
      const deliverTarget = ((): GclFarmDeliverTarget | null => {
        if (gclFarmInfo.deliverTargetId == null) {
          return null
        }
        return Game.getObjectById(gclFarmInfo.deliverTargetId) ?? null
      } )()
      const tasks: CreepTask[] = [
        MoveToTask.create(decodeRoomPosition(gclFarmInfo.deliverDestinationPosition, this.targetRoomName), 0),
      ]
      if (deliverTarget != null) {
        tasks.push(RunApiTask.create(TransferEnergyApiWrapper.create(deliverTarget)))
      }
      tasks.push(RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY)))
      return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
    }

    if (objects.activeStructures.storage != null) {
      return MoveToTransferHaulerTask.create(TransferEnergyApiWrapper.create(objects.activeStructures.storage)) // TODO: repair
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTransferHaulerTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    const spawn = objects.activeStructures.spawns[0]
    if (spawn == null) {
      creep.say("no storage")
      return MoveToRoomTask.create(this.targetRoomName, [])
    }

    const resource = spawn.pos.findInRange(FIND_DROPPED_RESOURCES, 3)[0]
    if (resource == null) {
      if (creep.pos.getRangeTo(spawn.pos) <= 3) {
        return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
      }
      return MoveToTask.create(spawn.pos, 3)
    }
    if (creep.pos.isEqualTo(resource.pos) === true) {
      return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
    }
    return MoveToTask.create(resource.pos, 0)
  }

  private getEnergySource(energySources: EnergySource[]): EnergyStore | null {
    const targetRoom = World.rooms.get(this.targetRoomName)
    if (targetRoom != null) {
      const droppedEnergy = targetRoom.find(FIND_DROPPED_RESOURCES).find(resource => {
        if (500 * resource.v5TargetedBy.length < getEnergyAmountOf(resource)) {
          return true
        }
        return false
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
        const lTargetedBy = lhs.v5TargetedBy.length
        const rTargetedBy = rhs.v5TargetedBy.length
        if (lTargetedBy === rTargetedBy) {
          return getEnergyAmountOf(lhs) > getEnergyAmountOf(rhs) ? lhs : rhs
        }
        return lTargetedBy < rTargetedBy ? lhs : rhs
      })
    }
    return null
  }
}

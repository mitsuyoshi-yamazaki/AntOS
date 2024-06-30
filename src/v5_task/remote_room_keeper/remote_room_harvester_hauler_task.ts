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
import { CreepBody } from "utility/creep_body"
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
import { AnyCreepApiWrapper } from "v5_object_task/creep_task/creep_api_wrapper"
import { TargetingApiWrapper } from "v5_object_task/targeting_api_wrapper"
import type { RoomName } from "shared/utility/room_name_types"
import { roomTypeOf } from "utility/room_coordinate"
import { CpuMeasurer, CpuPointMeasurer } from "shared/utility/cpu_measurer"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText } from "utility/log"
import { RoomResources } from "room_resource/room_resources"

// const cpuUsageHandler = (identifier: string, cpuUsage: number): void => {
//   PrimitiveLogger.log(`${coloredText("[CPU]", "critical")} ${identifier}: ${cpuUsage}`)
// }
// const cpuMeasurer = new CpuMeasurer(cpuUsageHandler, 2)
// const pointMeasurer = new CpuPointMeasurer(cpuUsageHandler, 1, "default")

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
    // problemFinders.push(...cpuMeasurer.measure(() => this.runHauler(objects), `${this.taskIdentifier}-runHauler`))
    problemFinders.push(...this.runHauler(objects))

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private runHauler(objects: OwnedRoomObjects): ProblemFinder[] {
    // pointMeasurer.reset(this.taskIdentifier)

    const energySources = this.energySources.flatMap(source => source.energySources)
    // pointMeasurer.measure(`p00-${energySources.length}`)

    const filterTaskIdentifier = this.taskIdentifier

    const problemFinders: ProblemFinder[] = [
    ]
    // pointMeasurer.measure("p0nth")
    // pointMeasurer.measure("p0")

    // const a = Game.cpu.getUsed() - Game.cpu.getUsed()
    // if (a < -0.1) {
    //   console.log(`[Game.cpu.getUsed()] ${a}`)
    // }

    if (objects.activeStructures.storage != null) {
      // pointMeasurer.measure("p0.0")
      // pointMeasurer.measure("p0.0nth")
      const hasEnergy = energySources.some(source => getEnergyAmountOf(source) > 500)
      // pointMeasurer.measure("p0.1")
      // pointMeasurer.measure("p0.1nth")
      if (hasEnergy === true) {
        const targetRoomResource = RoomResources.getNormalRoomResource(this.targetRoomName)
        if (targetRoomResource != null) {
          // pointMeasurer.measure("p0.2")
          // pointMeasurer.measure("p0.2nth")
          const invaded = targetRoomResource.hostiles.creeps.some(creep => (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0))
          // pointMeasurer.measure(`p0.3 (${targetRoomResource.hostiles.creeps.length})`)
          // pointMeasurer.measure("p0.3nth")
          if (invaded !== true) {
            // pointMeasurer.measure("p0.4")
            // pointMeasurer.measure("p0.4nth")
            const energyCapacity = this.energySources.reduce((result, current) => result + current.energyCapacity, 0)
            // pointMeasurer.measure(`p0.40-${energyCapacity}`)
            const minimumCreepCount = Math.ceil(energyCapacity / 2000) // TODO: 距離等を加味する
            problemFinders.push(this.createCreepInsufficiencyProblemFinder(objects, filterTaskIdentifier, minimumCreepCount))
            // pointMeasurer.measure("p0.5")
          }
        }
      }
    }

    // pointMeasurer.measure("p1")

    this.checkProblemFinders(problemFinders)

    // pointMeasurer.measure(`p2 childtasks: ${this.children.length}`)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        // const task = cpuMeasurer.measure(() => this.newTaskForHauler(creep, objects, energySources), `${this.taskIdentifier}`)
        // pointMeasurer.measure(`newTask0 for ${creep.name}`)
        const task = this.newTaskForHauler(creep, objects, energySources)
        // pointMeasurer.measure(`newTask1 for ${creep.name}`)

        if (task == null) {
          return null
        }
        if (roomTypeOf(this.roomName) === "source_keeper") {
          return FleeFromSKLairTask.create(task)
        }
        return FleeFromAttackerTask.create(task, 6, { failOnFlee: true })
      },
    )

    // pointMeasurer.measure("p3")

    return problemFinders
  }

  private createCreepInsufficiencyProblemFinder(
    objects: OwnedRoomObjects,
    filterTaskIdentifier: TaskIdentifier,
    minimumCreepCount: number,
  ): ProblemFinder {
    const roomName = objects.controller.room.name
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, null, [], filterTaskIdentifier, minimumCreepCount)

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
    const energyCapacity = objects.controller.room.energyCapacityAvailable

    if (((Game.time + this.startTime) % 16) <= 2) {
      const bodyUnit: BodyPartConstant[] = [
        WORK, CARRY, MOVE, CARRY, CARRY, MOVE,
      ]
      return CreepBody.create([], bodyUnit, energyCapacity, 5)
    } else {
      const bodyUnit: BodyPartConstant[] = [
        CARRY, CARRY, MOVE,
      ]
      return CreepBody.create([], bodyUnit, energyCapacity, 16)
    }
  }

  // ---- Creep Task ---- //
  private newTaskForHauler(creep: Creep, objects: OwnedRoomObjects, energySources: EnergySource[]): CreepTask | null {
    const createMoveToTargetTask = (apiWrapper: AnyCreepApiWrapper & TargetingApiWrapper): MoveToTargetTask | MoveToRoomTask => {
      // const remoteRoomInfo = RoomResources.getOwnedRoomResource(this.roomName)?.roomInfo.remoteRoomInfo[this.targetRoomName]
      // if (remoteRoomInfo != null && remoteRoomInfo.testConfig?.travelerEnabled === true) {
      //   return TravelToTargetTask.create(apiWrapper)
      // }
      // const destinationRoomName = apiWrapper.target.pos.roomName
      // if (creep.room.name !== destinationRoomName) {
      //   const waypoints = GameMap.getWaypoints(creep.room.name, destinationRoomName) ?? []
      //   return MoveToRoomTask.create(destinationRoomName, waypoints)
      // }
      return MoveToTargetTask.create(apiWrapper, {fallbackEnabled: true})
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
        const powerStorage = objects.activeStructures.terminal ?? objects.activeStructures.storage
        if (powerStorage != null) {
          return createMoveToTargetTask(TransferResourceApiWrapper.create(powerStorage, RESOURCE_POWER))
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
            return createMoveToTargetTask(PickupApiWrapper.create(droppedPower))
          }

          const tombstone = targetRoom.find(FIND_TOMBSTONES)
            .filter(tombstone => getResourceAmountOf(tombstone, RESOURCE_POWER))[0]
          if (tombstone != null) {
            return createMoveToTargetTask(WithdrawResourceApiWrapper.create(tombstone, RESOURCE_POWER))
          }
        }
      }
      const energySource = this.getEnergySource(energySources)
      if (energySource != null) {
        return createMoveToTargetTask(GetEnergyApiWrapper.create(energySource))
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
      })()

      if (deliverTarget != null) {
        const tasks: CreepTask[] = [
          createMoveToTargetTask(TransferEnergyApiWrapper.create(deliverTarget)),
        ]
        return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
      }
    }

    if (objects.activeStructures.storage != null) {
      if (objects.activeStructures.storage.store.getFreeCapacity(RESOURCE_ENERGY) > creep.store.getUsedCapacity(RESOURCE_ENERGY)) {
        if (creep.getActiveBodyparts(WORK) > 0) {
          return MoveToTransferHaulerTask.create(TransferEnergyApiWrapper.create(objects.activeStructures.storage))
        }
        return createMoveToTargetTask(TransferEnergyApiWrapper.create(objects.activeStructures.storage))
      }

      creep.say("full")
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      if (creep.getActiveBodyparts(WORK) > 0) {
        return MoveToTransferHaulerTask.create(TransferEnergyApiWrapper.create(structureToCharge))
      }
      return createMoveToTargetTask(TransferEnergyApiWrapper.create(structureToCharge))
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

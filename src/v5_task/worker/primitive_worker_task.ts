import { RoomName, roomTypeOf } from "utility/room_name"
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
import { ProblemFinder } from "v5_problem/problem_finder"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { TaskState } from "v5_task/task_state"
import { TempRenewApiWrapper } from "v5_object_task/creep_task/api_wrapper/temp_renew_api_wrapper"
import { bodyCost, CreepBody } from "utility/creep_body"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { RoomResources } from "room_resource/room_resources"
import { GameConstants } from "utility/constants"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"

export interface PrimitiveWorkerTaskState extends TaskState {
  /** room name */
  r: RoomName

  neighboursToObserve: RoomName[]
}

/**
 * - harvest, build, upgrade全て行う
 */
export class PrimitiveWorkerTask extends Task {
  public readonly taskIdentifier: TaskIdentifier

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    private readonly neighboursToObserve: RoomName[],
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): PrimitiveWorkerTaskState {
    return {
      t: "PrimitiveWorkerTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      neighboursToObserve: this.neighboursToObserve,
    }
  }

  public static decode(state: PrimitiveWorkerTaskState, children: Task[]): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(state.s, children, state.r, state.neighboursToObserve ?? [])
  }

  public static create(roomName: RoomName): PrimitiveWorkerTask {
    const neighboursToObserve = ((): RoomName[] => {
      const exits = Game.map.describeExits(roomName)
      if (exits == null) { // sim環境ではundefinedが返る
        return []
      }
      return Array.from(Object.values(exits)).filter(neighbourRoomName => {
        if (roomTypeOf(neighbourRoomName) !== "normal") {
          return false
        }
        return true
      })
    })()
    return new PrimitiveWorkerTask(Game.time, [], roomName, neighboursToObserve)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const necessaryRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover, CreepRole.EnergyStore]
    const filterTaskIdentifier = null
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
    ]

    if (objects.roomInfo.bootstrapping !== true) {
      problemFinders.push(this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, filterTaskIdentifier))
    }

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
  private createCreepInsufficiencyProblemFinder(objects: OwnedRoomObjects, necessaryRoles: CreepRole[], filterTaskIdentifier: TaskIdentifier | null): ProblemFinder {
    const creepSpec = this.creepSpec(objects)

    const roomName = objects.controller.room.name
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, necessaryRoles, filterTaskIdentifier, creepSpec.creepCount)

    const noCreeps = World.resourcePools.countCreeps(this.roomName, filterTaskIdentifier, () => true) <= 2
    const body: BodyPartConstant[] = creepSpec.body
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

  private creepSpec(objects: OwnedRoomObjects): { creepCount: number, body: BodyPartConstant[] } {
    const bodyUnit = ((): BodyPartConstant[] => {
      // if (objects.controller.room.energyCapacityAvailable <= 300) {
      return [WORK, MOVE, CARRY]
      // }
      // return [WORK, MOVE, MOVE, CARRY]
    })()
    const body = CreepBody.create([], bodyUnit, objects.controller.room.energyCapacityAvailable, 6)
    const neighbourRoomSourceCount = ((): number => {
      const roomInfo = RoomResources.getRoomInfo(this.roomName)
      if (roomInfo == null) {
        return 0
      }
      return roomInfo.neighbourRoomNames.reduce((result, current) => {
        const neighbourRoomInfo = RoomResources.getRoomInfo(current)
        if (neighbourRoomInfo == null) {
          return result
        }
        return result + neighbourRoomInfo.numberOfSources
      }, 0)
    })()

    const workCount = body.filter(b => b === WORK).length
    const ownedRoomSourceEnergyCapacity = objects.sources.reduce((result, current) => result + current.energyCapacity, 0)
    const estimatedUnownedSourceCapacity = 1500
    const estimatedNeighbourSourceEnergyCapacity = neighbourRoomSourceCount * estimatedUnownedSourceCapacity
    const energyCapacity = ownedRoomSourceEnergyCapacity + estimatedNeighbourSourceEnergyCapacity
    const requiredWorkCount = ((energyCapacity / 300) / GameConstants.creep.actionPower.harvest) * 2 // *2は移動等
    const creepCount = Math.ceil(requiredWorkCount / workCount)

    return {
      creepCount,
      body,
    }
  }

  // ---- Creep Task ---- //
  private newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const droppedEnergy = objects.droppedResources.find(resource => resource.resourceType === RESOURCE_ENERGY)
      if (droppedEnergy != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(droppedEnergy))
      }

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

      if (this.neighboursToObserve.length > 0 && objects.controller.level >= 2) {
        const removeRoomName = (roomName: RoomName): void => {
          const index = this.neighboursToObserve.indexOf(roomName)
          if (index < 0) {
            return
          }
          this.neighboursToObserve.splice(index, 1)
        }
        for (const neighbourRoomName of [...this.neighboursToObserve]) {
          removeRoomName(neighbourRoomName)
          const neighbourRoomInfo = RoomResources.getRoomInfo(neighbourRoomName)
          if (neighbourRoomInfo != null) {
            continue
          }
          return MoveToRoomTask.create(neighbourRoomName, [])
        }
      }

      const source = objects.getSource(creep.pos)
      if (source == null) {
        return null
      }
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
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

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller, 1), { reusePath: 3, ignoreSwamp: false })
  }
}

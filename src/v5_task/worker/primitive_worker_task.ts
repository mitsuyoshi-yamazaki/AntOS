import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { RepairApiWrapper } from "v5_object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { MoveToTargetTask, MoveToTargetTaskOptions } from "v5_object_task/creep_task/combined_task/move_to_target_task"
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
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { NormalRoomInfo } from "room_resource/room_info"
import type { RoomName } from "shared/utility/room_name_types"
import { roomTypeOf } from "utility/room_coordinate"

function moveToOptions(): MoveToTargetTaskOptions {
  return {
    reusePath: 0,
    ignoreSwamp: false,
    ignoreCreepsInRemote: true,
  }
}

export interface PrimitiveWorkerTaskState extends TaskState {
  /** room name */
  r: RoomName

  neighboursToObserve: RoomName[]
  sourceEmptyNeighbourCounts: {[sourceId: string]: number}
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
    private readonly sourceEmptyNeighbourCounts: { [sourceId: string]: number },
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
      sourceEmptyNeighbourCounts: this.sourceEmptyNeighbourCounts,
    }
  }

  public static decode(state: PrimitiveWorkerTaskState, children: Task[]): PrimitiveWorkerTask {
    return new PrimitiveWorkerTask(state.s, children, state.r, state.neighboursToObserve ?? [], state.sourceEmptyNeighbourCounts ?? {})
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
    return new PrimitiveWorkerTask(Game.time, [], roomName, neighboursToObserve, {})
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const necessaryRoles: CreepRole[] = [CreepRole.Worker, CreepRole.Mover, CreepRole.EnergyStore]
    const filterTaskIdentifier = null
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const neighbourRoomNames = RoomResources.getRoomInfo(this.roomName)?.neighbourRoomNames ?? []
    const harvestableNeighbourRooms: {roomName: RoomName, roomInfo: NormalRoomInfo}[] = neighbourRoomNames.flatMap(neighbourRoomName => {
      const neighbourRoomInfo = RoomResources.getRoomInfo(neighbourRoomName)
      if (neighbourRoomInfo == null) {
        return []
      }
      if (neighbourRoomInfo.roomType !== "normal" || roomTypeOf(neighbourRoomName) !== "normal") {
        return []
      }
      if (neighbourRoomInfo.owner != null) {
        return []
      }
      if (neighbourRoomInfo.numberOfSources <= 0) {
        return []
      }
      return {
        roomName: neighbourRoomName,
        roomInfo: neighbourRoomInfo,
      }
    })

    const problemFinders: ProblemFinder[] = [
    ]

    if (objects.roomInfo.bootstrapping !== true) {
      const neighbourRoomSourceCount = harvestableNeighbourRooms.reduce((result, current) => result + current.roomInfo.numberOfSources, 0)
      problemFinders.push(this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, filterTaskIdentifier, neighbourRoomSourceCount))
    }

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      filterTaskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        return this.newTaskFor(creep, objects, harvestableNeighbourRooms.map(info => info.roomName))
      },
      creepPoolFilter,
    )

    return TaskStatus.InProgress
  }

  // ---- Problem Solver ---- //
  private createCreepInsufficiencyProblemFinder(objects: OwnedRoomObjects, necessaryRoles: CreepRole[], filterTaskIdentifier: TaskIdentifier | null, neighbourRoomSourceCount: number): ProblemFinder {
    const creepSpec = this.creepSpec(objects, neighbourRoomSourceCount)

    const roomName = objects.controller.room.name
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, necessaryRoles, filterTaskIdentifier, creepSpec.creepCount)

    const noCreeps = World.resourcePools.countCreeps(this.roomName, filterTaskIdentifier, () => true) <= 2
    const [body, priority] = ((): [BodyPartConstant[], CreepSpawnRequestPriority] => {
      if (noCreeps === true) {
        return [[WORK, CARRY, MOVE], CreepSpawnRequestPriority.Urgent]
      }
      return [creepSpec.body, CreepSpawnRequestPriority.Medium]
    })()

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

  private creepSpec(objects: OwnedRoomObjects, neighbourRoomSourceCount: number): { creepCount: number, body: BodyPartConstant[] } {
    const bodyUnit = ((): BodyPartConstant[] => {
      // if (objects.controller.room.energyCapacityAvailable <= 300) {
      return [WORK, MOVE, CARRY]
      // }
      // return [WORK, MOVE, MOVE, CARRY]
    })()
    const body = CreepBody.create([], bodyUnit, objects.controller.room.energyCapacityAvailable, 6)

    const workCount = body.filter(b => b === WORK).length
    const ownedRoomSourceEnergyCapacity = objects.sources.reduce((result, current) => result + current.energyCapacity, 0)
    const estimatedUnownedSourceCapacity = 1500
    const estimatedNeighbourSourceEnergyCapacity = neighbourRoomSourceCount * estimatedUnownedSourceCapacity

    const getRequiredCreepCount = (energyCapacity: number, multiplier: number): number => {
      const rawCreepCount = ((energyCapacity / 300) / GameConstants.creep.actionPower.harvestEnergy) / workCount
      return Math.ceil(rawCreepCount * multiplier) + objects.controller.level
    }

    const requiredCreepCount = getRequiredCreepCount(ownedRoomSourceEnergyCapacity, 3) + getRequiredCreepCount(estimatedNeighbourSourceEnergyCapacity, 4)
    const maxCreepCount = ((): number => {
      if (objects.controller.level <= 1) {
        return 12
      }
      if (objects.controller.room.energyCapacityAvailable <= 400) {
        return 20
      }
      return objects.sources.length * 8 + neighbourRoomSourceCount * 10
    })()
    const creepCount = Math.min(requiredCreepCount, maxCreepCount, 60)

    return {
      creepCount,
      body,
    }
  }

  // ---- Creep Task ---- //
  private newTaskFor(creep: Creep, objects: OwnedRoomObjects, harvestableNeighbourRooms: RoomName[]): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy) {
      const droppedEnergy = objects.droppedResources.find(resource => resource.resourceType === RESOURCE_ENERGY)
      if (droppedEnergy != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(droppedEnergy), moveToOptions())
      }

      if (creep.ticksToLive != null && creep.ticksToLive < 400) {
        const spawn = objects.activeStructures.spawns[0]
        const room = objects.controller.room
        if (spawn != null && room.energyAvailable > 150) {
          const cost = bodyCost(creep.body.map(b => b.type))
          if (cost > room.energyCapacityAvailable) {
            return MoveToTargetTask.create(TempRenewApiWrapper.create(spawn), moveToOptions())
          }
        }
      }

      if (this.neighboursToObserve.length > 0) {
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

      const harvestTask = this.getHarvestTaskFor(creep, objects, harvestableNeighbourRooms)
      if (harvestTask == null) {
        creep.say("no source")
        return null
      }
      return harvestTask
    }

    const structureToCharge = objects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge), moveToOptions())
    }

    const damagedStructure = objects.getRepairStructure()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure), moveToOptions())
    }
    const constructionSite = objects.getConstructionSite(creep.pos)
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite), moveToOptions())
    }
    if (objects.constructionSites[0] != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(objects.constructionSites[0]), moveToOptions())
    }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(objects.controller, 1), moveToOptions())
  }

  private getHarvestTaskFor(creep: Creep, objects: OwnedRoomObjects, harvestableNeighbourRooms: RoomName[]): CreepTask | null {
    const isRoomHarvestable = (neighbourRoom: Room): boolean => {
      return neighbourRoom.controller == null
        || neighbourRoom.controller.owner == null
        || neighbourRoom.controller.reservation == null
        || neighbourRoom.controller.reservation.username === Game.user.name
    }

    if (creep.room.name !== this.roomName) {
      if (isRoomHarvestable(creep.room) === true) {
        const source = creep.room.find(FIND_SOURCES).sort((lhs, rhs) => {
          return lhs.v5TargetedBy.length - rhs.v5TargetedBy.length
        })[0]
        if (source != null) {
          return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source), moveToOptions())
        }
        console.log(`room ${creep.room.name} has no source`)
      } else {
        console.log(`room ${creep.room.name} occupied`)
      }
    }

    const workPartCount = creep.body.filter(body => body.type === WORK).length

    const ownedRoomSource = objects.sources.find(source => {
      if (source.energy <= 0 && source.ticksToRegeneration > 20) {
        return false
      }
      const neighbourCount = this.sourceNeighbourCount(source)
      const maxWorkCount = Math.ceil(((source.energyCapacity / 300) / GameConstants.creep.actionPower.harvestEnergy))
      const creepEnergyCapacity = Math.ceil(maxWorkCount / workPartCount)
      const creepCapacity = Math.min(creepEnergyCapacity, neighbourCount) + 1
      return source.v5TargetedBy.length < creepCapacity
    })

    if (ownedRoomSource != null) {
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(ownedRoomSource), moveToOptions())
    }

    const neighbourSources: Source[] = []
    for (const harvestableNeighbourRoom of harvestableNeighbourRooms) {
      const room = Game.rooms[harvestableNeighbourRoom]
      if (room == null) {
        return MoveToRoomTask.create(harvestableNeighbourRoom, [])
      }
      if (isRoomHarvestable(room) === true) {
        neighbourSources.push(...room.find(FIND_SOURCES))
      }
    }

    const targetSource = neighbourSources.sort((lhs, rhs) => {
      return lhs.v5TargetedBy.length - rhs.v5TargetedBy.length
    })[0] ?? objects.sources[0]
    if (targetSource != null) {
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(targetSource), moveToOptions())
    }
    return null
  }

  private sourceNeighbourCount(source: Source): number {
    const storedValue = this.sourceEmptyNeighbourCounts[source.id]
    if (storedValue != null) {
      return storedValue
    }
    const options: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeWalkableStructures: false,
      excludeTerrainWalls: true,
    }
    const neighbourCount = source.pos.positionsInRange(1, options).length
    this.sourceEmptyNeighbourCounts[source.id] = neighbourCount
    return neighbourCount
  }
}

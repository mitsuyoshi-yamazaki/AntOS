import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName } from "utility/room_name"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "v5_task/general/general_creep_worker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { World } from "world_info/world_info"
import { CreepRole } from "prototype/creep_role"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { DropResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/drop_resource_api_wrapper"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { RepairApiWrapper } from "v5_object_task/creep_task/api_wrapper/repair_api_wrapper"
import { bodyCost } from "utility/creep_body"
import { TempRenewApiWrapper } from "v5_object_task/creep_task/api_wrapper/temp_renew_api_wrapper"

const defaultNumberOfCreeps = 10

export interface UpgradeToRcl3TaskState extends GeneralCreepWorkerTaskState {
  /** parent room name */
  r: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]
}

/**
 * - RCLになりTowerとSpawnの建設が終わるまで
 *   - Tower, SpawnのConstruction Siteの設置はCreateConstructionSiteTaskが行っている
 */
export class UpgradeToRcl3Task extends GeneralCreepWorkerTask {
  public readonly taskIdentifier: TaskIdentifier

  private readonly codename: string

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[]
  ) {
    super(startTime, children, parentRoomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)
  }

  public encode(): UpgradeToRcl3TaskState {
    return {
      t: "UpgradeToRcl3Task",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints
    }
  }

  public static decode(state: UpgradeToRcl3TaskState, children: Task[]): UpgradeToRcl3Task {
    return new UpgradeToRcl3Task(state.s, children, state.r, state.tr, state.w)
  }

  public static create(parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): UpgradeToRcl3Task {
    return new UpgradeToRcl3Task(Game.time, [], parentRoomName, targetRoomName, waypoints)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (targetRoomObjects != null) {
      if (targetRoomObjects.activeStructures.spawns.length > 0 && targetRoomObjects.controller.level >= 3) {
        this.takeOverCreeps()
        targetRoomObjects.roomInfo.bootstrapping = false
        return TaskStatus.Finished
      }
      targetRoomObjects.roomInfo.bootstrapping = true
    }

    super.runTask(objects, childTaskResults)

    const problemFinders: ProblemFinder[] = [
    ]
    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  public creepFileterRoles(): CreepRole[] | null {
    return [CreepRole.Worker, CreepRole.Mover]
  }

  public creepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest | null {
    const numberOfCreeps = ((): number => {
      if (this.targetRoomName === "W11S14") {
        if (objects.activeStructures.spawns.length <= 0) {
          return 15
        }
      }
      return defaultNumberOfCreeps
    })()

    return {
      necessaryRoles: [CreepRole.Worker, CreepRole.Mover, CreepRole.EnergyStore],
      taskIdentifier: this.taskIdentifier,
      numberOfCreeps,
      codename: this.codename,
      initialTask: MoveToRoomTask.create(this.targetRoomName, this.waypoints),
      priority: CreepSpawnRequestPriority.Low,
      body: this.creepBody(objects.controller.room.energyCapacityAvailable)
    }
  }

  public newTaskFor(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (targetRoomObjects == null) {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
        const sources = creep.room.find(FIND_SOURCES)
        if (sources.length > 0) {
          const source = sources[Game.time % sources.length]
          if (source != null) {
            return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
          }
          creep.say("no source")
          return null
        }
      } else {
        const constructionSite = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES)
        if (constructionSite != null) {
          return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
        }

        return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
      }
      return null
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      if (creep.ticksToLive != null && creep.ticksToLive < 400) {
        const spawn = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } }) as StructureSpawn | null
        if (spawn != null && spawn.room.energyAvailable > 150) {
          const cost = bodyCost(creep.body.map(b => b.type))
          if (cost > spawn.room.energyCapacityAvailable) {
            return MoveToTargetTask.create(TempRenewApiWrapper.create(spawn))
          }
        }
      }

      const droppedEnergy = this.getDroppedEnergy(creep.pos, targetRoomObjects)
      if (droppedEnergy != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(droppedEnergy))
      }

      const source = targetRoomObjects.getSource(creep.pos)
      if (source != null) {
        return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
      }
      creep.say("no source")
      return null
    }

    if (targetRoomObjects.controller.level < 2) {
      return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(targetRoomObjects.controller))
    }

    const structureToCharge = targetRoomObjects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    const damagedStructure = targetRoomObjects.getRepairStructure()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
    }

    // const constructionSite = targetRoomObjects.getConstructionSite()
    const constructionSite = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES)
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(targetRoomObjects.controller))
  }

  private getDroppedEnergy(position: RoomPosition, targetRoomObjects: OwnedRoomObjects): Resource | null {
    const droppedResources = targetRoomObjects.droppedResources.filter(resource => {
      if (resource.resourceType !== RESOURCE_ENERGY) {
        return false
      }
      if (resource.v5TargetedBy.length > 0) {
        return false
      }
      return true
    })
    if (droppedResources.length <= 0) {
      return null
    }
    return droppedResources.reduce((lhs, rhs) => {
      return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
    })
  }

  // ---- Creep Body ---- //
  private creepBody(energyCapacity: number): BodyPartConstant[] {
    const bodyUnit = [CARRY, WORK, MOVE, MOVE]
    const unitCost = bodyCost(bodyUnit)
    const unitMaxCount = 6
    const unitCount = Math.max(Math.min(Math.floor(energyCapacity / unitCost), unitMaxCount), 1)
    const body: BodyPartConstant[] = []

    for (let i = 0; i < unitCount; i += 1) {
      body.push(...bodyUnit)
    }
    return body
  }

  // ---- Take Over Creeps ---- //
  private takeOverCreeps(): void {
    World.resourcePools.takeOverCreeps(this.parentRoomName, this.taskIdentifier, null, this.targetRoomName)
  }
}

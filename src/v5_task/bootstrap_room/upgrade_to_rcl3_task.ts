import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName, roomTypeOf } from "utility/room_name"
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
import { RoomResources } from "room_resource/room_resources"

const minimumNumberOfCreeps = 6
const defaultNumberOfCreeps = 10
const increasedNumberOfCreeps = 15

function neighboursToObserve(roomName: RoomName): RoomName[] {
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
}


export interface UpgradeToRcl3TaskState extends GeneralCreepWorkerTaskState {
  /** parent room name */
  r: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  neighboursToObserve: RoomName[]
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
    private readonly waypoints: RoomName[],
    private readonly neighboursToObserve: RoomName[],
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
      w: this.waypoints,
      neighboursToObserve: this.neighboursToObserve,
    }
  }

  public static decode(state: UpgradeToRcl3TaskState, children: Task[]): UpgradeToRcl3Task {
    return new UpgradeToRcl3Task(state.s, children, state.r, state.tr, state.w, state.neighboursToObserve)
  }

  public static create(parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): UpgradeToRcl3Task {
    return new UpgradeToRcl3Task(Game.time, [], parentRoomName, targetRoomName, waypoints, neighboursToObserve(targetRoomName))
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (targetRoomObjects != null) {
      if (targetRoomObjects.activeStructures.spawns.length > 0 && targetRoomObjects.activeStructures.storage != null) {
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
      if (this.targetRoomName === "W11S14" || this.targetRoomName === "W17S11") {
        const targetRoom = Game.rooms[this.targetRoomName]
        if (targetRoom == null) {
          return increasedNumberOfCreeps
        }
        if (targetRoom.find(FIND_MY_STRUCTURES, { filter: {structureType: STRUCTURE_SPAWN}}).length <= 0) {
          return increasedNumberOfCreeps
        }
      }
      if (this.targetRoomName === "W15S8") {
        return minimumNumberOfCreeps
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
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
        const creepRoomInfo = RoomResources.getRoomInfo(creep.room.name)
        if (creepRoomInfo != null && creepRoomInfo.neighbourRoomNames.includes(this.targetRoomName) === true) {
          const source = creep.room.find(FIND_SOURCES).sort((lhs, rhs) => {
            return lhs.v5TargetedBy.length - rhs.v5TargetedBy.length
          })[0]
          if (source != null) {
            return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
          }
        }
        return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      }
    }

    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (targetRoomObjects == null) {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
        const sources = creep.room.find(FIND_SOURCES)
        const source = sources[Game.time % sources.length]
        if (source != null) {
          return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
        }
        creep.say("no source")
        return null
      } else {
        const constructionSite = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES)
        if (constructionSite != null) {
          return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
        }

        return RunApiTask.create(DropResourceApiWrapper.create(RESOURCE_ENERGY))
      }
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      const droppedEnergy = this.getDroppedEnergy(creep.pos, targetRoomObjects)
      if (droppedEnergy != null) {
        return MoveToTargetTask.create(GetEnergyApiWrapper.create(droppedEnergy))
      }

      const source = targetRoomObjects.getSource(creep.pos)
      if (source != null) {
        return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source), { reusePath: 3, ignoreSwamp: false })
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
      return this.getNeighbourHarvestTaskFor(creep)
    }

    if (targetRoomObjects.controller.level < 2) {
      return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(targetRoomObjects.controller), {reusePath: 3, ignoreSwamp: false})
    }

    const structureToCharge = targetRoomObjects.getStructureToCharge(creep.pos)
    if (structureToCharge != null) {
      return MoveToTargetTask.create(TransferEnergyApiWrapper.create(structureToCharge))
    }

    const damagedStructure = targetRoomObjects.getRepairStructure()
    if (damagedStructure != null) {
      return MoveToTargetTask.create(RepairApiWrapper.create(damagedStructure))
    }

    if (creep.ticksToLive != null && creep.ticksToLive < 400) {
      const spawn = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } }) as StructureSpawn | null
      if (spawn != null && spawn.room.energyAvailable > 150) {
        const cost = bodyCost(creep.body.map(b => b.type))
        if (cost > spawn.room.energyCapacityAvailable) {
          return MoveToTargetTask.create(TempRenewApiWrapper.create(spawn))
        }
      }
    }

    // const constructionSite = targetRoomObjects.getConstructionSite()
    const constructionSite = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES)
    if (constructionSite != null) {
      return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
    }

    return MoveToTargetTask.create(UpgradeControllerApiWrapper.create(targetRoomObjects.controller), { reusePath: 3, ignoreSwamp: false })
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

  private getNeighbourHarvestTaskFor(creep: Creep): CreepTask | null {
    const resources = RoomResources.getOwnedRoomResource(this.targetRoomName)
    if (resources?.roomInfo == null) {
      return null
    }

    const harvestableNeighbourRooms: RoomName[] = resources.roomInfo.neighbourRoomNames.flatMap(neighbourRoomName => {
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
      return neighbourRoomName
    })

    const neighbourSources: Source[] = []
    for (const harvestableNeighbourRoom of harvestableNeighbourRooms) {
      const room = Game.rooms[harvestableNeighbourRoom]
      if (room == null) {
        return MoveToRoomTask.create(harvestableNeighbourRoom, [])
      }
      neighbourSources.push(...room.find(FIND_SOURCES))
    }

    const targetSource = neighbourSources.sort((lhs, rhs) => {
      return lhs.v5TargetedBy.length - rhs.v5TargetedBy.length
    })[0]
    if (targetSource != null) {
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(targetSource))
    }
    creep.say("nothing")
    return null
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

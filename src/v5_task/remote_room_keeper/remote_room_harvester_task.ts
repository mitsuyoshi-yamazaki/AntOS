import { Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "v5_problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "v5_task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename, generateUniqueId } from "utility/unique_id"
import { ProblemFinder } from "v5_problem/problem_finder"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { EnergySourceTask } from "v5_task/hauler/owned_room_energy_source_task"
import { EnergySource } from "prototype/room_object"
import { RepairApiWrapper } from "v5_object_task/creep_task/api_wrapper/repair_api_wrapper"
import { TaskState } from "v5_task/task_state"
import { placeRoadConstructionMarks } from "script/pathfinder"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { bodyCost } from "utility/creep_body"
import { FleeFromSKLairTask } from "v5_object_task/creep_task/combined_task/flee_from_sk_lair_task"
import { GameConstants } from "utility/constants"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { GclFarmResources } from "room_resource/gcl_farm_resources"
import { RoomResources } from "room_resource/room_resources"
import { RemoteRoomInfo } from "room_resource/room_info"
import { GameMap } from "game/game_map"
import { coloredText, roomLink } from "utility/log"
import type { RoomName } from "shared/utility/room_name_types"
import { roomTypeOf } from "utility/room_coordinate"
// import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"

const routeRecalculationInterval = 80000

export interface RemoteRoomHarvesterTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** target room name */
  tr: RoomName

  /** source id */
  i: Id<Source>

  /** container */
  co: {
    /** id */
    i: Id<StructureContainer> | null
  }
}

export class RemoteRoomHarvesterTask extends EnergySourceTask {
  public readonly taskIdentifier: TaskIdentifier
  public get energySources(): EnergySource[] {
    if (this.containerId == null) {
      return []
    }
    const container = Game.getObjectById(this.containerId)
    return container != null ? [container] : []
  }
  public get energyCapacity(): number {
    return Game.getObjectById(this.sourceId)?.energyCapacity ?? 0
  }

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly sourceId: Id<Source>,
    private containerId: Id<StructureContainer> | null,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}_${this.sourceId}`
  }

  public encode(): RemoteRoomHarvesterTaskState {
    return {
      t: "RemoteRoomHarvesterTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      tr: this.targetRoomName,
      i: this.sourceId,
      co: {
        i: this.containerId ?? null,
      },
    }
  }

  public static decode(state: RemoteRoomHarvesterTaskState, children: Task[]): RemoteRoomHarvesterTask | null {
    return new RemoteRoomHarvesterTask(state.s, children, state.r, state.tr, state.i, state.co.i)
  }

  public static create(roomName: RoomName, source: Source): RemoteRoomHarvesterTask {
    const targetRoomName = source.room.name
    const children: Task[] = [
    ]
    return new RemoteRoomHarvesterTask(Game.time, children, roomName, targetRoomName, source.id, null)
  }

  public runTask(objects: OwnedRoomObjects): TaskStatus {
    const source = Game.getObjectById(this.sourceId)
    if (source == null) {
      return TaskStatus.InProgress  // TODO: もう少し良い解決法ないか
    }

    const container = ((): StructureContainer | null => {
      if (this.containerId == null) {
        return null
      }
      const stored = Game.getObjectById(this.containerId)
      if (stored == null) {
        this.containerId = null
        return null
      }
      return stored
    })()

    if (container == null) {
      const constructed = source.pos.findInRange(FIND_STRUCTURES, 1, { filter: { structureType: STRUCTURE_CONTAINER } })[0] as StructureContainer | null
      if (constructed != null) {
        this.containerId = constructed.id
      }
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource != null) {
      if (roomResource.roomInfo.remoteRoomInfo[this.targetRoomName] == null) {
        // Migration: 稼働中にここに入ることはない
        const routeCalculatedTimestamp: { [sourceId: string]: number } = {}
        routeCalculatedTimestamp[source.id] = Game.time - Math.floor(Math.random() * routeRecalculationInterval)

        roomResource.roomInfo.remoteRoomInfo[this.targetRoomName] = {
          roomName: this.targetRoomName,
          enabled: true,
          routeCalculatedTimestamp,
          constructionFinished: false,
        }

        PrimitiveLogger.log(`${coloredText("[Migrated]", "warn")} remote room info ${roomLink(this.targetRoomName)} set to ${roomLink(this.roomName)}`)
      }
      const targetRoomInfo = roomResource.roomInfo.remoteRoomInfo[this.targetRoomName]
      if (targetRoomInfo != null) {
        if (targetRoomInfo.constructionFinished === false && (((Game.time + this.startTime) % 10) === 0)) {
          this.createConstructionSites(source, targetRoomInfo)
        }

        const targetRoom = Game.rooms[this.targetRoomName]
        const routeCalculatedTimestamp = targetRoomInfo.routeCalculatedTimestamp[source.id]
        if (routeCalculatedTimestamp == null) {
          const index = ((): number => {
            if (targetRoom == null) {
              return 0
            }
            return targetRoom.find(FIND_SOURCES).findIndex(source => source.id === this.sourceId)
          })()
          targetRoomInfo.routeCalculatedTimestamp[source.id] = Game.time - routeRecalculationInterval + index   // 乱数を設定するのはMigration時のみ
        } else {
          if (targetRoom != null && (Game.time > (routeCalculatedTimestamp + routeRecalculationInterval))) {
            this.calculateRoute(objects, source, targetRoomInfo, targetRoom, container)
          }
        }
      }
    }

    const problemFinders: ProblemFinder[] = []

    problemFinders.push(...this.runHarvester(objects, source, container))

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private runHarvester(
    objects: OwnedRoomObjects,
    source: Source,
    container: StructureContainer | null,
  ): ProblemFinder[] {
    const isBuildingContainer = (this.containerId == null)
    const minimumCreepCount = isBuildingContainer ? 2 : 1

    const problemFinders: ProblemFinder[] = [
    ]

    if (objects.controller.level > 2) {
      const targetRoom = World.rooms.get(this.targetRoomName)
      if (targetRoom != null && (targetRoom.controller == null || targetRoom.controller.reservation == null || targetRoom.controller.reservation.username === Game.user.name)) {
        const invaded = targetRoom.find(FIND_HOSTILE_CREEPS).some(creep => (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0))
        if (invaded !== true) {
          const isConstructing = isBuildingContainer || (targetRoom.find(FIND_MY_CONSTRUCTION_SITES).length > 0)
          problemFinders.push(this.createCreepInsufficiencyProblemFinder(objects, minimumCreepCount, source, isConstructing))
        }
      }
    }

    this.checkProblemFinders(problemFinders)

    World.resourcePools.assignTasks(
      objects.controller.room.name,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      (creep: Creep): CreepTask | null => {
        const task = this.newTaskForHarvester(creep, source, container)
        if (task == null) {
          return null
        }
        if (roomTypeOf(this.roomName) === "source_keeper") {
          return FleeFromSKLairTask.create(task)
        }
        return FleeFromAttackerTask.create(task, 6, { failOnFlee: true })
      },
    )

    return problemFinders
  }

  private createCreepInsufficiencyProblemFinder(
    objects: OwnedRoomObjects,
    minimumCreepCount: number,
    source: Source,
    isConstructing: boolean,
  ): ProblemFinder {
    const roomName = objects.controller.room.name
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, null, [], this.taskIdentifier, minimumCreepCount)

    const problemFinderWrapper: ProblemFinder = {
      identifier: problemFinder.identifier,
      problemExists: () => problemFinder.problemExists(),
      getProblemSolvers: () => {
        const solver = problemFinder.getProblemSolvers()[0] // TODO: 選定する
        if (solver instanceof CreepInsufficiencyProblemSolver) {
          solver.codename = generateCodename(this.constructor.name, this.startTime)
          // solver.initialTask = MoveToTask.create(source.pos, 1)
          solver.priority = CreepSpawnRequestPriority.Medium

          const energyCapacity = objects.controller.room.energyCapacityAvailable
          solver.body = isConstructing ? this.builderBody(energyCapacity) : this.harvesterBody(source, energyCapacity, objects.controller.level)
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

  private builderBody(energyCapacity: number): BodyPartConstant[] {
    const unit: BodyPartConstant[] = [CARRY, WORK, MOVE]
    const maxUnits = 6
    const unitCost = bodyCost(unit)
    const count = Math.max(Math.min(Math.floor(energyCapacity / unitCost), maxUnits), 1)

    const body: BodyPartConstant[] = []

    for (let i = 0; i < count; i += 1) {
      body.push(...unit)
    }
    return body
  }

  private harvesterBody(source: Source, energyCapacity: number, rcl: number): BodyPartConstant[] {
    const moveSpeed = 1.0
    const terrainCost = 1
    const sourceEnergyCapacity = source.energyCapacity
    const maximumWorkCount = ((): number => {
      const defaultCount = (sourceEnergyCapacity / 300) / HARVEST_POWER
      if (rcl < 8 || Memory.gameInfo.enableCpuOptimization !== true) {
        return Math.ceil(defaultCount) + 1
      }
      return Math.ceil(defaultCount * 2) + 1
    })()

    const constructBody = ((workCount: number): BodyPartConstant[] => {
      const result: BodyPartConstant[] = []
      for (let i = 0; i < workCount; i += 1) {
        result.push(WORK)
      }
      result.push(CARRY)
      const moveCount = Math.ceil((result.length / 2) * terrainCost * moveSpeed)
      for (let i = 0; i < moveCount; i += 1) {
        result.unshift(MOVE)
      }
      return result
    })

    for (let i = maximumWorkCount; i >= 1; i -= 1) {
      const body = constructBody(i)
      const cost = bodyCost(body)
      if (cost <= energyCapacity) {
        return body
      }
    }
    return constructBody(1)
  }

  // ---- Creep Task ---- //
  private newTaskForHarvester(
    creep: Creep,
    source: Source,
    container: StructureContainer | null,
  ): CreepTask | null {
    const noEnergy = creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0

    if (noEnergy === true) {
      if (container != null) {
        const harvestPosition = container.pos
        if (creep.pos.isEqualTo(harvestPosition) === true) {
          return RunApiTask.create(HarvestEnergyApiWrapper.create(source))
        }
        // if (creep.room.name !== this.targetRoomName) {
        //   const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
        //   return MoveToRoomTask.create(this.targetRoomName, waypoints)
        // }
        return MoveToTask.create(harvestPosition, 0)
      }
      // if (creep.room.name !== this.targetRoomName) {
      //   const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
      //   return MoveToRoomTask.create(this.targetRoomName, waypoints)
      // }
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
    }

    if (container != null && container.hits < container.hitsMax * 0.8) {
      if (creep.pos.getRangeTo(container.pos) > GameConstants.creep.actionRange.repair) {
        return MoveToTargetTask.create(RepairApiWrapper.create(container))
      }
      return RunApiTask.create(RepairApiWrapper.create(container))
    }

    if (GclFarmResources.isGclFarm(this.targetRoomName) === true) {
      const constructionSite = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, { filter: { structureType: STRUCTURE_ROAD } })
      if (constructionSite != null) {
        return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
      }
    } else {
      const constructionSite = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES)
      if (constructionSite != null) {
        return MoveToTargetTask.create(BuildApiWrapper.create(constructionSite))
      }
    }

    if (creep.pos.getRangeTo(source.pos) > GameConstants.creep.actionRange.harvest) {
      return MoveToTargetTask.create(HarvestEnergyApiWrapper.create(source))
    }
    return RunApiTask.create(HarvestEnergyApiWrapper.create(source))
  }

  private createConstructionSites(source: Source, targetRoomInfo: RemoteRoomInfo): void {
    const roomResource = RoomResources.getNormalRoomResource(this.targetRoomName)
    if (roomResource == null || roomResource.constructionSites.length >= 3) {
      return
    }
    const flag = source.pos.findClosestByRange(FIND_FLAGS, { filter: { color: COLOR_BROWN } })
    if (flag == null) {
      targetRoomInfo.constructionFinished = true
      return
    }
    const result = source.room.createConstructionSite(flag.pos.x, flag.pos.y, STRUCTURE_ROAD)
    switch (result) {
    case OK:
    case ERR_INVALID_TARGET:  // 設置済み等
      flag.remove()
      return

    case ERR_NOT_OWNER:
    case ERR_FULL:
      return

    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.programError(`${this.taskIdentifier} createConstructionSite() in ${flag.pos} failed with error ${result}`)
      return
    }
  }

  private calculateRoute(objects: OwnedRoomObjects, source: Source, targetRoomInfo: RemoteRoomInfo, targetRoom: Room, container: StructureContainer | null): void {
    const hasContainer = container != null
    const sourcePosition = source.pos
    const storage = objects.activeStructures.storage
    if (storage == null) {
      return
    }
    targetRoomInfo.routeCalculatedTimestamp[source.id] = Game.time
    targetRoomInfo.constructionFinished = false

    const codename = generateCodename(this.constructor.name, this.startTime)
    const range = hasContainer ? 2 : 1
    const disableRouteWaypoint = false

    const result = placeRoadConstructionMarks(storage.pos, sourcePosition, codename, {range, disableRouteWaypoint})

    try {
      switch (result.resultType) {
      case "succeeded": {
        this.constructInWaypointRooms(result.value)
        if (hasContainer !== true) {
          const lastPosition = result.value[result.value.length - 1]
          if (lastPosition == null) {
            throw `no path from ${sourcePosition} to ${storage.pos}`
          }
          const hasContainerConstructionSite = source.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, { filter: {structureType: STRUCTURE_CONTAINER}}).length > 0
          if (hasContainerConstructionSite !== true) {
            this.createContainer(lastPosition, codename, targetRoom)
          }
        }
        break
      }

      case "failed":
        throw `failed to place roads ${result.reason}`
      }

    } catch (error) {
      PrimitiveLogger.fatal(`${this.taskIdentifier} calculateRoute() ${roomLink(this.targetRoomName)} ${error}`)
    }
    PrimitiveLogger.log(`${this.taskIdentifier} calculateRoute() ${roomLink(this.targetRoomName)}`)
  }

  /** throws */
  private createContainer(position: RoomPosition, codename: string, targetRoom: Room): void {
    const result = targetRoom.createConstructionSite(position, STRUCTURE_CONTAINER)
    if (result === OK) {
      return
    }
    const flagResult = targetRoom.createFlag(position, generateUniqueId(codename), COLOR_YELLOW)
    if (typeof flagResult === "string") {
      return
    }
    throw `createConstructionSite() returns ${result}, createFlag() returns ${flagResult} at ${position}`
  }

  private constructInWaypointRooms(route: RoomPosition[]): void {
    const remoteRoomInfo = RoomResources.getOwnedRoomResource(this.roomName)?.roomInfo.remoteRoomInfo
    if (remoteRoomInfo == null) {
      return
    }

    const roomNames: RoomName[] = []
    const excludedRoomNames: RoomName[] = [this.roomName, this.targetRoomName]
    route.forEach(position => {
      if (excludedRoomNames.includes(position.roomName) === true) {
        return
      }
      if (roomNames.includes(position.roomName) === true) {
        return
      }
      roomNames.push(position.roomName)
    })

    roomNames.forEach(roomName => {
      const info = remoteRoomInfo[roomName]
      if (info == null) {
        return
      }
      info.constructionFinished = false
    })

    if (GameMap.getWaypoints(this.roomName, this.targetRoomName, {ignoreMissingWaypoints: true}) == null) {
      GameMap.setWaypoints(this.roomName, this.targetRoomName, roomNames)
    }
  }
}

import { RoomName, roomTypeOf } from "utility/room_name"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority, CreepPoolFilter } from "world_info/resource_pool/creep_resource_pool"
import { World } from "world_info/world_info"
import { CreepInsufficiencyProblemFinder } from "v5_problem/creep_insufficiency/creep_insufficiency_problem_finder"
import { CreepInsufficiencyProblemSolver } from "v5_task/creep_spawn/creep_insufficiency_problem_solver"
import { generateCodename } from "utility/unique_id"
import { ProblemFinder } from "v5_problem/problem_finder"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { EnergySourceTask } from "v5_task/hauler/owned_room_energy_source_task"
import { EnergySource } from "prototype/room_object"
import { RepairApiWrapper } from "v5_object_task/creep_task/api_wrapper/repair_api_wrapper"
import { BuildContainerTask } from "v5_task/build/build_container_task"
import { roomLink } from "utility/log"
import { TaskState } from "v5_task/task_state"
import { placeRoadConstructionMarks } from "script/pathfinder"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { BuildApiWrapper } from "v5_object_task/creep_task/api_wrapper/build_api_wrapper"
import { bodyCost } from "utility/creep_body"
import { FleeFromSKLairTask } from "v5_object_task/creep_task/combined_task/flee_from_sk_lair_task"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { GameConstants } from "utility/constants"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { GclFarmResources } from "room_resource/gcl_farm_resources"
import { Timestamp } from "utility/timestamp"
import { RoomResources } from "room_resource/room_resources"

type Construction = {
  routeCalculatedTimestamp: Timestamp
  constructionFinished: boolean
}

const routeRecalculationInterval = 40000

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

    noContainerPosition: boolean
  }

  readonly construction: Construction
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
    private noContainerPosition: boolean,
    private readonly construction: Construction,
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
        noContainerPosition: this.noContainerPosition,
      },
      construction: this.construction,
    }
  }

  public static decode(state: RemoteRoomHarvesterTaskState, children: Task[]): RemoteRoomHarvesterTask | null {
    const construction = ((): Construction => { // FixMe: Migration
      if (state.construction != null) {
        return state.construction
      }
      return {
        routeCalculatedTimestamp: state.s % routeRecalculationInterval,
        constructionFinished: true,
      }
    })()
    return new RemoteRoomHarvesterTask(state.s, children, state.r, state.tr, state.i, state.co.i, state.co.noContainerPosition ?? false, construction)
  }

  public static create(roomName: RoomName, source: Source): RemoteRoomHarvesterTask {
    const targetRoomName = source.room.name
    const children: Task[] = [
    ]
    const construction: Construction = {
      routeCalculatedTimestamp: 0,
      constructionFinished: false,
    }
    return new RemoteRoomHarvesterTask(Game.time, children, roomName, targetRoomName, source.id, null, false, construction)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const source = Game.getObjectById(this.sourceId)
    if (source == null) {
      // TODO: initialTaskにmoveToRoomを入れておく
      return TaskStatus.InProgress  // TODO: もう少し良い解決法ないか
    }

    if (this.construction.constructionFinished === false && (((Game.time + this.startTime) % 10) === 0)) {
      this.createConstructionSites(source)
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

    const problemFinders: ProblemFinder[] = []

    if (container == null && this.noContainerPosition !== true) {
      this.checkContainer(objects, childTaskResults.finishedTasks, source)
    }

    if (container != null) {
      if (Game.time > (this.construction.routeCalculatedTimestamp + routeRecalculationInterval)) {
        this.placeRoadConstructMarks(objects, container)
      }
    }

    problemFinders.push(...this.runHarvester(objects, source, container))

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private runHarvester(
    objects: OwnedRoomObjects,
    source: Source,
    container: StructureContainer | null,
  ): ProblemFinder[] {
    const necessaryRoles: CreepRole[] = [CreepRole.Harvester, CreepRole.Mover, CreepRole.EnergyStore]
    const isBuildingContainer = (this.containerId == null) && (this.noContainerPosition !== true)
    const minimumCreepCount = isBuildingContainer ? 3 : 1
    const creepPoolFilter: CreepPoolFilter = creep => hasNecessaryRoles(creep, necessaryRoles)

    const problemFinders: ProblemFinder[] = [
    ]

    if (objects.controller.level > 2) {
      const targetRoom = World.rooms.get(this.targetRoomName)
      if (targetRoom != null && (targetRoom.controller == null || targetRoom.controller.reservation == null || targetRoom.controller.reservation.username === Game.user.name)) {
        const invaded = targetRoom.find(FIND_HOSTILE_CREEPS).some(creep => (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0))
        if (invaded !== true) {
          const isConstructing = isBuildingContainer || (targetRoom.find(FIND_MY_CONSTRUCTION_SITES).length > 0)
          problemFinders.push(this.createCreepInsufficiencyProblemFinder(objects, necessaryRoles, minimumCreepCount, source, isConstructing))
        }
      }
    }

    this.checkProblemFinders(problemFinders)

    if (isBuildingContainer !== true) {  // container == nullの場合はBuildContainerTaskがcreepを制御する
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
        creepPoolFilter,
      )
    }

    return problemFinders
  }

  private createCreepInsufficiencyProblemFinder(
    objects: OwnedRoomObjects,
    necessaryRoles: CreepRole[],
    minimumCreepCount: number,
    source: Source,
    isConstructing: boolean,
  ): ProblemFinder {
    const roomName = objects.controller.room.name
    const problemFinder = new CreepInsufficiencyProblemFinder(roomName, necessaryRoles, necessaryRoles, this.taskIdentifier, minimumCreepCount)

    const problemFinderWrapper: ProblemFinder = {
      identifier: problemFinder.identifier,
      problemExists: () => problemFinder.problemExists(),
      getProblemSolvers: () => {
        const solver = problemFinder.getProblemSolvers()[0] // TODO: 選定する
        if (solver instanceof CreepInsufficiencyProblemSolver) {
          solver.codename = generateCodename(this.constructor.name, this.startTime)
          solver.initialTask = MoveToTask.create(source.pos, 1)
          solver.priority = CreepSpawnRequestPriority.Medium

          const energyCapacity = objects.controller.room.energyCapacityAvailable
          solver.body = isConstructing ? this.builderBody(energyCapacity) : this.harvesterBody(source, energyCapacity)
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

  private harvesterBody(source: Source, energyCapacity: number): BodyPartConstant[] {
    const moveSpeed = 1.0
    const terrainCost = 1
    const sourceEnergyCapacity = source.energyCapacity
    const maximumWorkCount = Math.ceil((sourceEnergyCapacity / 300) / HARVEST_POWER) + 1

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

    if (noEnergy) {
      if (container != null) {
        const harvestPosition = container.pos
        if (creep.pos.isEqualTo(harvestPosition) === true) {
          return RunApiTask.create(HarvestEnergyApiWrapper.create(source))
        }
        return MoveToTask.create(harvestPosition, 0)
      }
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

  // ---- Build Container ---- //
  private checkContainer(objects: OwnedRoomObjects, finishedChildTasks: Task[], source: Source): void {
    const finishedBuildContainerTask = finishedChildTasks.find(task => task instanceof BuildContainerTask) as BuildContainerTask | null
    if (finishedBuildContainerTask != null) {
      const containerId = finishedBuildContainerTask.container?.id ?? null
      if (containerId == null) {
        return
      }
      this.containerId = containerId
      const container = Game.getObjectById(containerId)
      if (container != null) {
        this.placeRoadConstructMarks(objects, container)
      }
      return
    }

    const buildContainerTask = this.children.find(task => task instanceof BuildContainerTask) as BuildContainerTask | null
    if (buildContainerTask != null) {
      return
    }
    this.launchBuildContainerTask(objects, source)
  }

  private launchBuildContainerTask(objects: OwnedRoomObjects, source: Source): void {
    const roomName = objects.controller.room.name

    const constructionSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).find(site => site.structureType === STRUCTURE_CONTAINER)
    if (constructionSite != null) {
      this.addChildTask(BuildContainerTask.create(roomName, constructionSite.pos, this.taskIdentifier))
      return
    }

    const positions: { [sourceId: string]: RoomPosition } = {
      "60d686cb0dd3bc23acfcb210": new RoomPosition(13, 40, "W5S27")
    }

    const cachedPosition = positions[source.id]

    if (cachedPosition != null) {
      this.addChildTask(BuildContainerTask.create(roomName, cachedPosition, this.taskIdentifier))
      return
    }
    const pathStartPosition = objects.activeStructures.storage?.pos ?? objects.activeStructures.spawns[0]?.pos
    if (pathStartPosition == null) {
      if ((Game.time % 17) === 11) {
        PrimitiveLogger.fatal(`No spawns or storage ${this.taskIdentifier} in ${roomLink(roomName)}`)
      }
      return
    }
    const resultPath = PathFinder.search(pathStartPosition, { pos: source.pos, range: 1 }, {
      maxRooms: 3,
      maxOps: 6000,
      swampCost: 2,
    })

    const path = resultPath.path
    const lastPathPosition = ((): RoomPosition | null => {
      if (path.length <= 0) {
        PrimitiveLogger.fatal(`Source route calculation failed ${this.taskIdentifier}, no path`)
        return null
      }
      const position = path[path.length - 1]
      if (position == null || position.isNearTo(source.pos) !== true) {
        return null
      }
      return position
    })()
    const containerPosition = ((): RoomPosition | null => {
      if (lastPathPosition != null) {
        return lastPathPosition
      }
      PrimitiveLogger.fatal(`Source route calculation failed ${this.taskIdentifier}, incomplete: ${resultPath.incomplete}, path: ${resultPath.path}`)
      const options: RoomPositionFilteringOptions = {
        excludeItself: true,
        excludeStructures: true,
        excludeTerrainWalls: true,
        excludeWalkableStructures: false,
      }
      return source.pos.positionsInRange(1, options)[0] ?? null
    })()

    if (containerPosition != null) {
      this.addChildTask(BuildContainerTask.create(roomName, containerPosition, this.taskIdentifier))
    } else {
      this.noContainerPosition = true
    }
    return
  }

  private createConstructionSites(source: Source): void {
    const roomResource = RoomResources.getNormalRoomResource(this.targetRoomName)
    if (roomResource == null || roomResource.constructionSites.length >= 3) {
      return
    }
    const flag = source.pos.findClosestByRange(FIND_FLAGS, { filter: { color: COLOR_BROWN } })
    if (flag == null) {
      this.construction.constructionFinished = true
      return
    }
    const result = source.room.createConstructionSite(flag.pos.x, flag.pos.y, STRUCTURE_ROAD)
    switch (result) {
    case OK:
    case ERR_INVALID_TARGET:  // 設置済み等
      flag.remove()
      return

    case ERR_FULL:
      return

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.programError(`${this.taskIdentifier} createConstructionSite() in ${flag.pos} failed with error ${result}`)
      return
    }
  }

  private placeRoadConstructMarks(objects: OwnedRoomObjects, container: StructureContainer): void {
    const storage = objects.activeStructures.storage
    if (storage == null) {
      return
    }
    this.construction.routeCalculatedTimestamp = Game.time
    this.construction.constructionFinished = false

    const codename = generateCodename(this.constructor.name, this.startTime)
    placeRoadConstructionMarks(storage.pos, container.pos, codename)
  }
}

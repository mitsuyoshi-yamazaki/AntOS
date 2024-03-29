import type { RoomName } from "shared/utility/room_name_types"
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
import { HarvestEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/harvest_energy_api_wrapper"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { EnergySourceTask } from "v5_task/hauler/owned_room_energy_source_task"
import { EnergySource } from "prototype/room_object"
import { BuildContainerTask } from "v5_task/build/build_container_task"
import { coloredText, roomLink } from "utility/log"
import { TaskState } from "v5_task/task_state"
import { placeRoadConstructionMarks } from "script/pathfinder"
import { bodyCost } from "utility/creep_body"
import { GameConstants } from "utility/constants"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { ContinuousRunApiTask } from "v5_object_task/creep_task/combined_task/continuous_run_apis_task"
import { AnyCreepApiWrapper } from "v5_object_task/creep_task/creep_api_wrapper"
import { FillEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/fill_energy_api_wrapper"
import { RoomResources } from "room_resource/room_resources"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { Environment } from "utility/environment"

export interface OwnedRoomHarvesterTaskState extends TaskState {
  /** room name */
  r: RoomName

  /** source id */
  i: Id<Source>

  /** container */
  co: {
    /** id */
    i: Id<StructureContainer> | null
  }

  canPlaceLink: boolean | null
}

export class OwnedRoomHarvesterTask extends EnergySourceTask {
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
    public readonly sourceId: Id<Source>,
    private containerId: Id<StructureContainer> | null,
    private canPlaceLink: boolean | null,
  ) {
    super(startTime, children)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}_${this.sourceId}`
  }

  public encode(): OwnedRoomHarvesterTaskState {
    return {
      t: "OwnedRoomHarvesterTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      i: this.sourceId,
      co: {
        i: this.containerId ?? null,
      },
      canPlaceLink: this.canPlaceLink,
    }
  }

  public static decode(state: OwnedRoomHarvesterTaskState, children: Task[]): OwnedRoomHarvesterTask | null {
    return new OwnedRoomHarvesterTask(state.s, children, state.r, state.i, state.co.i, state.canPlaceLink)
  }

  public static create(roomName: RoomName, source: Source): OwnedRoomHarvesterTask {
    return new OwnedRoomHarvesterTask(Game.time, [], roomName, source.id, null, null)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const source = Game.getObjectById(this.sourceId)
    if (source == null) {
      PrimitiveLogger.fatal(`${this.description()} source ${this.sourceId} not found`)
      return TaskStatus.Failed
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

    if (container != null) {  // FixMe: containerがないときでもrunHarvesterを行う
      problemFinders.push(...this.runHarvester(objects, source, container))
    } else {
      if (objects.activeStructures.spawns.length > 0) { // FixMe: SWC対応
        this.checkContainer(objects, childTaskResults.finishedTasks, source)
      }
    }

    // if (Environment.world === "swc") {
    //   const tasks = this.children.filter(task => {
    //     if (task instanceof BuildContainerTask) {
    //       return true
    //     }
    //     return false
    //   })
    //   tasks.forEach(task => this.removeChildTask(task))
    // }

    return TaskStatus.InProgress
  }

  // ---- Run & Check Problem ---- //
  private runHarvester(
    objects: OwnedRoomObjects,
    source: Source,
    container: StructureContainer,
  ): ProblemFinder[] {
    const minimumCreepCount = 1 // TODO: lifeが短くなってきたら次をspawnさせる

    const problemFinders: ProblemFinder[] = [
    ]

    if (objects.activeStructures.storage != null) {
      problemFinders.push(this.createCreepInsufficiencyProblemFinder(objects, minimumCreepCount, source))
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
        return FleeFromAttackerTask.create(task, 6, {failOnFlee: true})
      },
    )

    return problemFinders
  }

  private createCreepInsufficiencyProblemFinder(
    objects: OwnedRoomObjects,
    minimumCreepCount: number,
    source: Source,
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
          solver.initialTask = FleeFromAttackerTask.create(MoveToTask.create(source.pos, 1), 6, {failOnFlee: true})
          solver.priority = CreepSpawnRequestPriority.High
          solver.body = this.harvesterBody(source, objects.controller.level)
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

  private harvesterBody(source: Source, rcl: number): BodyPartConstant[] {
    const sourceCapacity = ((): number => {
      const effects = source.effects
      if (effects == null) {  // undefinedの場合がある
        return source.energyCapacity
      }
      const regenEffect = effects.find(effect => effect.effect === PWR_REGEN_SOURCE) as PowerEffect | null
      if (regenEffect == null) {
        return source.energyCapacity
      }
      const powerConstant = GameConstants.power.regenSource
      const value = powerConstant.value[regenEffect.level - 1]
      if (value == null) {
        PrimitiveLogger.programError(`Source ${source.id} in ${roomLink(source.room.name)} has effect with unimplemented level ${regenEffect.level}`)
        return source.energyCapacity
      }
      const additionalCapacity = (GameConstants.source.regenerationDuration / GameConstants.power.regenSource.duration) * value
      return source.energyCapacity + additionalCapacity
    })()

    const moveSpeed = 0.5
    const maximumWorkCount = ((): number => {
      const defaultWorkCount = (sourceCapacity / 300) / HARVEST_POWER
      if (rcl < 8 || Memory.gameInfo.enableCpuOptimization !== true) {
        return Math.ceil(defaultWorkCount) + 1
      }
      return Math.ceil(defaultWorkCount * 2) + 1
    })()

    const carryCount = ((): number => {
      const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
      if (roomResource?.roomInfoAccessor.sourceEnergyTransferType.case === "link") {
        return Math.ceil(maximumWorkCount / 6)
      }
      return 1
    })()

    const constructBody = ((workCount: number): BodyPartConstant[] => {
      const result: BodyPartConstant[] = []
      for (let i = 0; i < workCount; i += 1) {
        result.push(WORK)
      }
      result.push(...Array<BodyPartConstant>(carryCount).fill(CARRY))
      const moveCount = Math.ceil((result.length / 2) * moveSpeed)
      for (let i = 0; i < moveCount; i += 1) {
        result.unshift(MOVE)
      }
      return result
    })

    const energyCapacity = source.room.energyCapacityAvailable
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
    container: StructureContainer,
  ): CreepTask | null {
    const harvestPosition = container.pos
    if (creep.pos.isEqualTo(harvestPosition) !== true) {
      return MoveToTask.create(harvestPosition, 0)
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    let link = ((): StructureLink | null => {
      if (roomResource == null) {
        return null
      }
      return roomResource.roomInfoAccessor.links.sources.get(this.sourceId) ?? null
    })()

    if (link == null && roomResource != null && roomResource.controller.level >= 7) {
      link = this.checkLink(source, container.pos, roomResource)
    }

    const apiWrappers: AnyCreepApiWrapper[] = [
      HarvestEnergyApiWrapper.create(source, true),
    ]
    if (link != null) {
      apiWrappers.push(FillEnergyApiWrapper.create(link))
    }
    return ContinuousRunApiTask.create(apiWrappers)
  }

  private checkLink(source: Source, harvesterPosition: RoomPosition, roomResource: OwnedRoomResource): StructureLink | null {
    if (roomResource.hostiles.creeps.length > 0) {
      return null
    }
    if (harvesterPosition.findInRange(FIND_MY_CONSTRUCTION_SITES, 1).length > 0) {
      return null
    }

    const otherLinks: StructureLink[] = [
      ...Array.from(roomResource.roomInfoAccessor.links.sources.values()),
    ]
    if (roomResource.roomInfoAccessor.links.core) {
      otherLinks.push(roomResource.roomInfoAccessor.links.core)
    }
    if (roomResource.roomInfoAccessor.links.upgrader) {
      otherLinks.push(roomResource.roomInfoAccessor.links.upgrader)
    }
    const otherLinkIds = otherLinks.map(otherLink => otherLink.id)

    const targetLink = (harvesterPosition.findInRange(FIND_MY_STRUCTURES, 1, { filter: { structureType: STRUCTURE_LINK } }) as StructureLink[])
      .filter(link => {
        if (otherLinkIds.includes(link.id) === true) {
          return false
        }
        return true
      })[0]

    if (targetLink != null) {
      roomResource.roomInfoAccessor.setLinkId(targetLink.id, source.id)
      return targetLink
    }

    const logNoLinkPlaceError = (message: string): void => {
      PrimitiveLogger.log(`${coloredText("[Error]", "error")} ${this.taskIdentifier} no place for link ${source}, ${source.pos} in ${roomLink(this.roomName)} ${message}`)
    }

    if (this.canPlaceLink == null) {
      this.canPlaceLink = ((): boolean => {
        if (harvesterPosition.findInRange(FIND_SOURCES, 2).length >= 2) {
          logNoLinkPlaceError("other source too close")
          return false
        }
        const coreLink = roomResource.roomInfoAccessor.links.core
        if (coreLink != null && harvesterPosition.getRangeTo(coreLink.pos) <= 1) {
          logNoLinkPlaceError("core link too close")
          return false
        }
        const upgraderLink = roomResource.roomInfoAccessor.links.upgrader
        if (upgraderLink != null && harvesterPosition.getRangeTo(upgraderLink.pos) <= 1) {
          logNoLinkPlaceError("too close upgrader link")
          return false
        }
        if (harvesterPosition.getRangeTo(roomResource.controller.pos) <= 4) {
          logNoLinkPlaceError("too close controller")
          return false
        }
        return true
      })()
    }

    if (this.canPlaceLink !== true) {
      return null
    }

    const coreLinkPosition = roomResource.roomInfoAccessor.links.core?.pos ?? null
    const options: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeWalkableStructures: true,
      excludeTerrainWalls: true,
      allowedStructureTypes: [STRUCTURE_RAMPART],
    }
    const positions = harvesterPosition.positionsInRange(1, options)
      .filter(position => {
        return position.canConstruct()
      })
      .map(position => {
        const distance = ((): number => {
          if (coreLinkPosition == null) {
            return 0
          }
          return position.getRangeTo(coreLinkPosition)
        })()
        return {
          position,
          distance,
        }
      })

    positions.sort((lhs, rhs) => lhs.distance - rhs.distance)
    const linkPosition = positions[0]

    if (linkPosition == null) {
      this.canPlaceLink = false
      logNoLinkPlaceError("")
      return null
    }

    const result = roomResource.room.createConstructionSite(linkPosition.position.x, linkPosition.position.y, STRUCTURE_LINK)
    switch (result) {
    case OK:
    case ERR_FULL:
      break

    case ERR_NOT_OWNER:
    case ERR_INVALID_TARGET:
    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.fatal(`${this.taskIdentifier} createConstructionSite() failed with ${result} in ${roomLink(this.roomName)} ${source}, ${linkPosition.position}`)
      break
    }
    return null
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
    const position = ((): RoomPosition | null => {
      const options: RoomPositionFilteringOptions = {
        excludeItself: true,
        excludeStructures: true,
        excludeTerrainWalls: true,
        excludeWalkableStructures: false,
      }
      const neighbourPositions = source.pos.positionsInRange(1, options)
      if (neighbourPositions.length <= 1 && neighbourPositions[0] != null) {
        return neighbourPositions[0]
      }
      if (source.pos.findInRange(FIND_SOURCES, 2).length >= 2) {
        const emptyPositions = neighbourPositions.filter(p => p.findInRange(FIND_SOURCES, 1).length <= 1)
        if (emptyPositions[0] != null) {
          return emptyPositions[0]
        }
      }

      const pathStartPosition = objects.activeStructures.storage?.pos ?? objects.activeStructures.spawns[0]?.pos
      if (pathStartPosition == null) {
        if ((Game.time % 17) === 5) {
          PrimitiveLogger.fatal(`No spawns or storage ${this.taskIdentifier} in ${roomLink(roomName)}`)
        }
        return null
      }
      const resultPath = PathFinder.search(pathStartPosition, { pos: source.pos, range: 1 })
      if (resultPath.incomplete === true) {
        PrimitiveLogger.fatal(`Source route calculation failed ${this.taskIdentifier}, incomplete path: ${resultPath.path}`)
        return null  // TODO: 毎tick行わないようにする
      }

      const path = resultPath.path
      if (path.length <= 0) {
        PrimitiveLogger.fatal(`Source route calculation failed ${this.taskIdentifier}, no path`)
        return null  // TODO: 毎tick行わないようにする
      }
      return path[path.length - 1] ?? null
    })()

    if (position != null) {
      this.addChildTask(BuildContainerTask.create(roomName, position, this.taskIdentifier))
    }
    return
  }

  private placeRoadConstructMarks(objects: OwnedRoomObjects, container: StructureContainer): void {
    const storage = objects.activeStructures.storage
    if (storage == null) {
      return
    }

    const codename = generateCodename(this.constructor.name, this.startTime)
    placeRoadConstructionMarks(storage.pos, container.pos, codename)
  }
}

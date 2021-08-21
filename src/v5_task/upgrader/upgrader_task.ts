import { ProblemFinder } from "v5_problem/problem_finder"
import { RoomName } from "utility/room_name"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "v5_task/general/general_creep_worker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { TRANSFER_RESOURCE_RANGE, UPGRADE_CONTROLLER_RANGE } from "utility/constants"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { TargetToPositionTask } from "v5_object_task/creep_task/meta_task/target_to_position_task"
import type { AnyCreepApiWrapper } from "v5_object_task/creep_task/creep_api_wrapper"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { bodyCost } from "utility/creep_body"

export interface UpgraderTaskState extends GeneralCreepWorkerTaskState {
  /** room name */
  r: RoomName

  /** upgrader positions */
  p: RoomPositionState[]

  linkId: Id<StructureLink> | null
 }

export class UpgraderTask extends GeneralCreepWorkerTask {
  public readonly taskIdentifier: TaskIdentifier

  private readonly codename: string
  private availablePositions: RoomPosition[] = []

  private constructor(
    public readonly startTime: number,
    public readonly children: Task[],
    public readonly roomName: RoomName,
    private readonly upgraderPositions: RoomPosition[],
    private linkId: Id<StructureLink> | null,
  ) {
    super(startTime, children, roomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)
  }

  public encode(): UpgraderTaskState {
    return {
      t: "UpgraderTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      p: this.upgraderPositions.map(position => position.encode()),
      linkId: this.linkId,
    }
  }

  public static decode(state: UpgraderTaskState, children: Task[]): UpgraderTask {
    const upgraderPositions = state.p.map(positionState => decodeRoomPosition(positionState))
    return new UpgraderTask(state.s, children, state.r, upgraderPositions, state.linkId ?? null)
  }

  public static create(roomName: RoomName): UpgraderTask {
    const upgraderPositions: RoomPosition[] = []
    const objects = World.rooms.getOwnedRoomObjects(roomName)
    if (objects != null) {
      const controller = objects.controller
      const container = objects.roomInfo.upgrader?.container ?? controller.pos.findInRange(FIND_STRUCTURES, UPGRADE_CONTROLLER_RANGE).find(structure => structure.structureType === STRUCTURE_CONTAINER) as StructureContainer | null
      const link = controller.pos.findInRange(FIND_STRUCTURES, UPGRADE_CONTROLLER_RANGE).find(structure => structure.structureType === STRUCTURE_LINK) as StructureLink | null
      objects.roomInfo.upgrader = {
        container,
        link,
      }

      const options: RoomPositionFilteringOptions = {
        excludeItself: true,
        excludeTerrainWalls: true,
        excludeStructures: true,
        excludeWalkableStructures: false,
      }
      const positions = controller.pos.positionsInRange(UPGRADE_CONTROLLER_RANGE, options)
        .filter(position => {
          if (container == null) {
            return true
          }
          return position.getRangeTo(container.pos) <= TRANSFER_RESOURCE_RANGE
        })
      upgraderPositions.push(...positions)
    }

    return new UpgraderTask(Game.time, [], roomName, upgraderPositions, null)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const [sourcePosition1, sourcePosition2] = ((): [RoomPosition | null, RoomPosition | null] => {
      const container = objects.roomInfo.upgrader?.container
      const link = ((): StructureLink | null => {
        if (this.linkId == null) {
          return null
        }
        return Game.getObjectById(this.linkId)
      })()
      if (container != null) {
        return [container.pos, link?.pos ?? null]
      }
      return [link?.pos ?? null, null]
    })()

    if (sourcePosition1 == null) {
      this.availablePositions = []
    } else {
      this.availablePositions = this.upgraderPositions.filter(position => {
        if (sourcePosition2 == null) {
          if (position.isNearTo(sourcePosition1) !== true) {
            return false
          }
          return true
        }
        if (position.isNearTo(sourcePosition1) !== true) {
          return false
        }
        if (position.isNearTo(sourcePosition2) !== true) {
          return false
        }
        return true
      })
    }

    super.runTask(objects, childTaskResults)

    const problemFinders: ProblemFinder[] = [
    ]

    this.checkLink(objects)

    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  public creepFileterRoles(): CreepRole[] | null {
    return null
  }

  public creepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest | null {
    const container = objects.roomInfo.upgrader?.container
    if (container == null) {
      // console.log(`${this.taskIdentifier} no container`)
      return null
    }

    const [body, numberOfCreeps] = this.upgraderBody(objects)

    return {
      necessaryRoles: [CreepRole.Worker, CreepRole.Mover],
      taskIdentifier: this.taskIdentifier,
      numberOfCreeps,
      codename: this.codename,
      initialTask: null,
      priority: CreepSpawnRequestPriority.Low,
      body,
    }
  }

  public newTaskFor(creep: Creep, objects: OwnedRoomObjects): CreepTask | null {
    const container = objects.roomInfo.upgrader?.container
    const link = ((): StructureLink | null => {
      if (this.linkId == null) {
        return null
      }
      return Game.getObjectById(this.linkId)
    })()

    const emptyPosition = this.emptyPosition()
    if (emptyPosition == null) {
      creep.say("no dest")
      return null
    }
    const apiWrappers: AnyCreepApiWrapper[] = [
      UpgradeControllerApiWrapper.create(objects.controller),
    ]
    if (container != null) {
      apiWrappers.push(GetEnergyApiWrapper.create(container))
    }
    if (link != null) {
      apiWrappers.push(GetEnergyApiWrapper.create(link))
    }
    return TargetToPositionTask.create(emptyPosition, apiWrappers)
  }

  // ---- Private ---- //
  /**
   * @return body, numberOfCreeps
   */
  private upgraderBody(objects: OwnedRoomObjects): [BodyPartConstant[], number] {
    const isRcl8 = objects.controller.level === 8

    const bodyUnit = [WORK, WORK, WORK, MOVE]
    const unitCost = bodyCost(bodyUnit)
    const body: BodyPartConstant[] = [CARRY]

    const hasEnoughEnergy = ((): boolean => {
      if (objects.activeStructures.storage == null) {
        return false
      }
      const storedEnergy = objects.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY) + (objects.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      return storedEnergy > 130000
    })()

    const energyCapacity = objects.controller.room.energyCapacityAvailable
    const maxBodyCount = ((): number => {
      const max = Math.floor((energyCapacity - bodyCost(body)) / unitCost)
      if (hasEnoughEnergy !== true) {
        return Math.min(max, 2)
      }
      if (isRcl8 === true) {
        return Math.min(max, 5)
      }
      return Math.min(max, 8)
    })()

    for (let i = 0; i < maxBodyCount; i += 1) {
      body.unshift(...bodyUnit)
    }

    const numberOfCreeps = ((): number => {
      if (hasEnoughEnergy !== true) {
        return 1
      }
      if (isRcl8 === true) {
        return 1
      }
      if (objects.constructionSites.length > 0) {
        return 1
      }
      return this.availablePositions.length
    })()

    return [body, numberOfCreeps]
  }

  private emptyPosition(): RoomPosition | null {
    const emptyPositions = this.availablePositions.filter(position => {
      if (position.v5TargetedBy.length > 0) {
        return false
      }
      return true
    })
    if (emptyPositions[0] == null) {
      PrimitiveLogger.fatal(`[Program bug] UpgraderTask dosen't have empty position (${this.upgraderPositions})`)
      return null
    }
    return emptyPositions[0]
  }

  private checkLink(objects: OwnedRoomObjects): void {
    if (this.linkId != null || (Game.time % 2099) !== 0) {
      return
    }

    const link = objects.controller.pos.findInRange(FIND_STRUCTURES, 4, { filter: { structureType: STRUCTURE_LINK } })[0] as StructureLink | null
    if (link == null) {
      return
    }
    this.linkId = link.id
  }
}

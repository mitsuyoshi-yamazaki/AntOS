import { ProblemFinder } from "v5_problem/problem_finder"
import type { RoomName } from "shared/utility/room_name_types"
import { ChildTaskExecutionResults, Task, TaskIdentifier, TaskStatus } from "v5_task/task"
import { OwnedRoomObjects } from "world_info/room_info"
import { GeneralCreepWorkerTask, GeneralCreepWorkerTaskCreepRequest, GeneralCreepWorkerTaskState } from "v5_task/general/general_creep_worker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { World } from "world_info/world_info"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { GameConstants, TRANSFER_RESOURCE_RANGE, UPGRADE_CONTROLLER_RANGE } from "utility/constants"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { TargetToPositionTask } from "v5_object_task/creep_task/meta_task/target_to_position_task"
import type { AnyCreepApiWrapper } from "v5_object_task/creep_task/creep_api_wrapper"
import { GetEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/get_energy_api_wrapper"
import { UpgradeControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/upgrade_controller_api_wrapper"
import { bodyCost } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"
import { CreepBody } from "utility/creep_body"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"

export interface UpgraderTaskState extends GeneralCreepWorkerTaskState {
  /** room name */
  r: RoomName

  /** upgrader positions */
  p: RoomPositionState[]
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
  ) {
    super(startTime, children, roomName)

    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.taskIdentifier, this.startTime)

    if (upgraderPositions.length < 5) {
      const room = Game.rooms[roomName]
      if (room?.controller?.my === true && room.controller.level < 8) {
        if (upgraderPositions.length <= 0) {
          PrimitiveLogger.programError(`${this.taskIdentifier} no upgrader positions`)
        } else {
          PrimitiveLogger.programError(`${this.taskIdentifier} only ${upgraderPositions.length} upgrader positions ${upgraderPositions}`)
        }
      }
    }
  }

  public encode(): UpgraderTaskState {
    return {
      t: "UpgraderTask",
      s: this.startTime,
      c: this.children.map(task => task.encode()),
      r: this.roomName,
      p: this.upgraderPositions.map(position => position.encode()),
    }
  }

  public static decode(state: UpgraderTaskState, children: Task[]): UpgraderTask {
    const upgraderPositions = state.p.map(positionState => decodeRoomPosition(positionState))
    return new UpgraderTask(state.s, children, state.r, upgraderPositions)
  }

  public static create(roomName: RoomName): UpgraderTask {
    const upgraderPositions: RoomPosition[] = []
    const objects = World.rooms.getOwnedRoomObjects(roomName)
    if (objects != null) {
      const controller = objects.controller
      const container = objects.roomInfo.upgrader?.container ?? controller.pos.findInRange(FIND_STRUCTURES, UPGRADE_CONTROLLER_RANGE).find(structure => structure.structureType === STRUCTURE_CONTAINER) as StructureContainer | null
      objects.roomInfo.upgrader = {
        container,
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

    return new UpgraderTask(Game.time, [], roomName, upgraderPositions)
  }

  public runTask(objects: OwnedRoomObjects, childTaskResults: ChildTaskExecutionResults): TaskStatus {
    const container = objects.roomInfo.upgrader?.container
    const link = ((): StructureLink | null => {
      const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
      if (roomResource == null) {
        return null
      }
      return roomResource.roomInfoAccessor.links.upgrader
    })()

    this.checkEnergySource(objects)

    if (container == null && link == null) {
      this.availablePositions = []
    } else {
      const controller = objects.controller
      this.availablePositions = this.upgraderPositions.filter(position => {
        if (container != null && position.getRangeTo(container.pos) > 1) {
          return false
        }
        if (link != null && position.getRangeTo(link.pos) !== 1) {
          return false
        }
        if (position.getRangeTo(controller.pos) > GameConstants.creep.actionRange.upgradeController) {
          return false
        }
        return true
      })
    }
    if (this.availablePositions.length <= 0) {
      return TaskStatus.InProgress
    }

    super.runTask(objects, childTaskResults)

    const problemFinders: ProblemFinder[] = [
    ]

    this.checkProblemFinders(problemFinders)

    return TaskStatus.InProgress
  }

  public creepFileterRoles(): CreepRole[] | null {
    return null
  }

  public creepRequest(objects: OwnedRoomObjects): GeneralCreepWorkerTaskCreepRequest | null {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return null
    }
    const [body, numberOfCreeps] = this.upgraderBody(objects, roomResource)

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
      const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
      if (roomResource == null) {
        return null
      }
      return roomResource.roomInfoAccessor.links.upgrader
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
  private upgraderBody(objects: OwnedRoomObjects, roomResource: OwnedRoomResource): [BodyPartConstant[], number] {
    const isRcl8 = roomResource.controller.level >= 8
    const shouldUseMinimumUpgrader = ((): boolean => {
      if (isRcl8 === true && roomResource.roomInfo.ownedRoomType.case === "minimum-cpu-use") {
        return true
      }
      return false
    })()

    if (shouldUseMinimumUpgrader) {
      const creepCount = ((): number => {
        if (roomResource.controller.ticksToDowngrade > 160000) {
          return 0
        }
        return 1
      })()
      const body = CreepBody.create([CARRY], [WORK, WORK, MOVE], roomResource.room.energyCapacityAvailable, 7)
      return [body, creepCount]
    }

    const bodyUnit = [WORK, WORK, WORK, MOVE]
    const unitCost = bodyCost(bodyUnit)
    const body: BodyPartConstant[] = [CARRY]

    const storedEnergy = (objects.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
      + (objects.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)

    const hasEnoughEnergy = ((): boolean => {
      if (objects.activeStructures.storage == null) {
        return false
      }
      const numberOfRooms = RoomResources.getOwnedRoomResources().length
      if (numberOfRooms <= 1) {
        return storedEnergy > 10000
      }
      return storedEnergy > 130000
    })()

    const energyCapacity = objects.controller.room.energyCapacityAvailable
    const maxBodyCount = ((): number => {
      const max = Math.floor((energyCapacity - bodyCost(body)) / unitCost)
      if (isRcl8 === true) {
        if (storedEnergy < 40000) {
          return Math.min(max, 1)
        }
        return Math.min(max, 5)
      }
      if (hasEnoughEnergy !== true) {
        return Math.min(max, 2)
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
      const max = roomResource.roomInfoAccessor.config.upgraderMaxCount
      return Math.min(Math.max(this.availablePositions.length - 1, 3), max)  // 全位置を埋めるとHaulerが入って来れなくなるため
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
      PrimitiveLogger.fatal(`[Program bug] UpgraderTask doesn't have empty position\navailablePositions: ${this.availablePositions.join(", ")}\nupgraderPositions: (${this.upgraderPositions.map(position => `${position}: ${position.v5TargetedBy}`)})`)
      return null
    }
    return emptyPositions[0]
  }

  private checkEnergySource(objects: OwnedRoomObjects): void {
    if (((Game.time + this.startTime) % 197) !== 17) {
      return
    }
    if (objects.roomInfo.upgrader?.container == null) {
      const containers = objects.controller.pos.findInRange(FIND_STRUCTURES, 4, { filter: { structureType: STRUCTURE_CONTAINER } }) as StructureContainer[]
      const container = containers.find(c => {
        if (c.pos.findInRange(FIND_SOURCES, 1).length > 0) {
          return false
        }
        return true
      })
      if (container != null) {
        if (objects.roomInfo.upgrader == null) {
          objects.roomInfo.upgrader = {
            container,
          }
        } else {
          objects.roomInfo.upgrader.container = container
        }
      }
    }
  }
}

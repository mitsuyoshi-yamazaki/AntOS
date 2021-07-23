import { RoomName } from "utility/room_name"
import { OwnedRoomObjects } from "world_info/room_info"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { bodyCost } from "utility/creep_body"
import { Task } from "application/task"
import { TaskIdentifier } from "application/task_identifier"
import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { ConsumeTaskPerformance, ConsumeTaskPerformanceState, emptyConsumeTaskPerformanceState } from "application/task_profit/consume_task_performance"
import { TaskState } from "application/task_state"
import { GameConstants } from "utility/constants"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { parseId } from "prototype/room_object"

type UpgraderTaskOutputs = TaskOutputs<void, UnexpectedProblem>

export interface UpgraderTaskState extends TaskState {
  /** task type identifier */
  readonly t: "UpgraderTask"

  /** performance */
  readonly pf: ConsumeTaskPerformanceState

  containerId: Id<StructureContainer> | null
  upgraderPositions: RoomPositionState[]
}

export class UpgraderTask extends Task<void, UnexpectedProblem, ConsumeTaskPerformance, ConsumeTaskPerformanceState> {
  public readonly identifier: TaskIdentifier
  private readonly codename: string

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    public readonly performanceState: ConsumeTaskPerformanceState,
    private containerId: Id<StructureContainer> | null,
    private readonly upgraderPositions: RoomPosition[],
  ) {
    super(startTime, sessionStartTime, roomName, performanceState)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.startTime)
  }

  public encode(): UpgraderTaskState {
    return {
      t: "UpgraderTask",
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      pf: this.performanceState,
      containerId: this.containerId,
      upgraderPositions: this.upgraderPositions.map(position => position.encode()),
    }
  }

  public static decode(state: UpgraderTaskState): UpgraderTask {
    const upgraderPositions = state.upgraderPositions.map(positionState => decodeRoomPosition(positionState))
    return new UpgraderTask(state.s, state.ss, state.r, state.pf, state.containerId, upgraderPositions)
  }

  public static create(roomName: RoomName): UpgraderTask {
    const upgraderPositions: RoomPosition[] = []
    const objects = World.rooms.getOwnedRoomObjects(roomName)
    const upgradeRange = GameConstants.creep.actionRange.upgradeController
    if (objects != null) {
    }

    return new UpgraderTask(Game.time, Game.time, roomName, emptyConsumeTaskPerformanceState(), null, upgraderPositions)
  }

  public run(roomResource: OwnedRoomResource): UpgraderTaskOutputs {
    const output: UpgraderTaskOutputs = emptyTaskOutputs()
    const container = parseId(this.containerId)
    if (container == null) {
      this.containerId = null
    }

    if (Game.time % 1511 === 47) {
      this.checkUpgraderPositions(roomResource)
      this.checkContainer(roomResource)
    }

    // position等がなければ行う
    const creepCount = roomResource.runningCreepInfo(this.identifier)

    return output
  }

  private checkContainer(roomResource: OwnedRoomResource): void {

  }

  private checkUpgraderPositions(roomResource: OwnedRoomResource): void {
    const controller = roomResource.controller
    const container = objects.roomInfo.upgrader?.container ?? controller.pos.findInRange(FIND_STRUCTURES, upgradeRange).find(structure => structure.structureType === STRUCTURE_CONTAINER) as StructureContainer | null
    const link = controller.pos.findInRange(FIND_STRUCTURES, upgradeRange).find(structure => structure.structureType === STRUCTURE_LINK) as StructureLink | null
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
    const positions = controller.pos.positionsInRange(upgradeRange, options)
      .filter(position => {
        if (container == null) {
          return true
        }
        return position.getRangeTo(container.pos) <= GameConstants.creep.actionRange.transferResource
      })
    upgraderPositions.push(...positions)

  }

//
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
    if (container == null) {
      return null
    }

    const emptyPosition = this.emptyPosition()
    if (emptyPosition == null) {
      creep.say("no dest")
      return null
    }
    const apiWrappers: AnyCreepApiWrapper[] = [
      GetEnergyApiWrapper.create(container),
      UpgradeControllerApiWrapper.create(objects.controller),
    ]
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
      const storedEnergy = objects.activeStructures.storage.store.getUsedCapacity(RESOURCE_ENERGY)
      return storedEnergy > 100000
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
      return Math.min(max, 6)
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
      return 3
    })()

    return [body, numberOfCreeps]
  }

  private emptyPosition(): RoomPosition | null {
    const emptyPositions = this.upgraderPositions.filter(position => position.v5TargetedBy.length <= 0)
    if (emptyPositions[0] == null) {
      PrimitiveLogger.fatal(`[Program bug] UpgraderTask dosen't have empty position (${this.upgraderPositions})`)
      return null
    }
    return emptyPositions[0]
  }
}

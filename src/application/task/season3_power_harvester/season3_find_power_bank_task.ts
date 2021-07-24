import { UnexpectedProblem } from "application/problem/unexpected/unexpected_problem"
import { Task } from "application/task"
import { CreepSpawnTaskEvent, CreepSpawnTaskEventHandler } from "application/task_event"
import type { TaskIdentifier } from "application/task_identifier"
import { calculateObserveTaskPerformance, emptyObserveTaskPerformanceState, ObserveTaskPerformance, ObserveTaskPerformanceState } from "application/task_profit/observe_task_performance"
import { CreepTaskAssignTaskRequest, SpawnCreepTaskRequest, SpawnTaskRequestPriority } from "application/task_request"
import { emptyTaskOutputs, TaskOutputs } from "application/task_requests"
import { TaskState } from "application/task_state"
import { SequentialTask } from "object_task/creep_task/combined_task/sequential_task"
import { CreepTask } from "object_task/creep_task/creep_task"
import { MoveToRoomTask } from "object_task/creep_task/task/move_to_room_task"
import { ScoutRoomsTask } from "object_task/creep_task/task/scout_rooms_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { OwnedRoomResource, RunningCreepInfo } from "room_resource/room_resource/owned_room_resource"
import { GameConstants } from "utility/constants"
import { bodyCost } from "utility/creep_body"
import { Environment } from "utility/environment"
import { roomLink } from "utility/log"
import { RoomCoordinate, RoomName } from "utility/room_name"
import { RoomSector } from "utility/room_sector"
import type { Timestamp } from "utility/timestamp"
import { generateCodename } from "utility/unique_id"

type Season3FindPowerBankTaskProblemTypes = UnexpectedProblem

interface Season3FindPowerBankTaskScoutRoute {
  routeToHighway: RoomName[]
  highwayRoute: RoomName[]
  observeTargetRoomNames: RoomName[]
}

export interface Season3FindPowerBankTaskPowerBankInfo {
  roomName: RoomName,
  powerAmount: number,
  decayedBy: Timestamp,
  nearbySquareCount: number,
  waypoints: RoomName[],
}

interface Season3FindPowerBankTaskOutput {
  highwayTooFar: boolean
  powerBanks: Season3FindPowerBankTaskPowerBankInfo[]
}

export interface Season3FindPowerBankTaskState extends TaskState {
  /** task type identifier */
  readonly t: "Season3FindPowerBankTask"

  /** performance */
  readonly pf: ObserveTaskPerformanceState

  readonly scoutRoutes: Season3FindPowerBankTaskScoutRoute[]
  readonly powerBankInfo: { [index: string]: Season3FindPowerBankTaskPowerBankInfo} // index: RoomName
}

// - 探索する部屋を算出、保存
// - scout taskの生成
// - creep problemの処理
// - 探索対象のobserve, メモリへ格納
//   - log送付

/**
 * - Power Bankを見つける
 * - Power Bankの情報を上へ送る: 何らかの共有メモリに書き込む
 *   - Power Bankまでの距離
 *   - Power Amount
 * - 探索
 *   - 最寄りのhighwaysから上下左右に探索する
 */
export class Season3FindPowerBankTask
  extends Task<Season3FindPowerBankTaskOutput, Season3FindPowerBankTaskProblemTypes, ObserveTaskPerformance, ObserveTaskPerformanceState>
  implements CreepSpawnTaskEventHandler
{
  public readonly taskType = "Season3FindPowerBankTask"
  public readonly identifier: TaskIdentifier

  private readonly codename: string
  private readonly creepIdentifiers: number[]
  private readonly observeTargetRooms: RoomName[]

  protected constructor(
    startTime: number,
    sessionStartTime: number,
    roomName: RoomName,
    public readonly performanceState: ObserveTaskPerformanceState,
    private readonly scoutRoutes: Season3FindPowerBankTaskScoutRoute[],
    private powerBankInfo: { [index: string]: Season3FindPowerBankTaskPowerBankInfo },
  ) {
    super(startTime, sessionStartTime, roomName, performanceState)

    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.startTime)
    this.creepIdentifiers = this.scoutRoutes.map((route, index) => index)
    this.observeTargetRooms = this.scoutRoutes.flatMap(route => route.observeTargetRoomNames)
  }

  public encode(): Season3FindPowerBankTaskState {
    return {
      t: this.taskType,
      s: this.startTime,
      ss: this.sessionStartTime,
      r: this.roomName,
      pf: this.performanceState,
      scoutRoutes: this.scoutRoutes,
      powerBankInfo: this.powerBankInfo,
    }
  }

  public static decode(state: Season3FindPowerBankTaskState): Season3FindPowerBankTask {
    return new Season3FindPowerBankTask(state.s, state.ss, state.r, state.pf, state.scoutRoutes, state.powerBankInfo)
  }

  public static create(roomName: RoomName): Season3FindPowerBankTask | null {
    if (Environment.world !== "season 3") {
      PrimitiveLogger.programError(`${this.constructor.name} is not supported in ${Environment.world}`)
      return null
    }
    const scoutRoutes = calculateRoomRoutes(roomName)
    if (scoutRoutes == null) {
      return null
    }

    return new Season3FindPowerBankTask(
      Game.time,
      Game.time,
      roomName,
      emptyObserveTaskPerformanceState(),
      scoutRoutes,
      {},
    )
  }

  public run(roomResource: OwnedRoomResource): TaskOutputs<Season3FindPowerBankTaskOutput, Season3FindPowerBankTaskProblemTypes> {
    this.refreshPowerBankInfo()
    const foundPowerBankInfo = this.foundPowerBankInfo()
    foundPowerBankInfo.forEach(powerBankInfo => {
      this.powerBankInfo[powerBankInfo.roomName] = powerBankInfo
    })

    const outputs: TaskOutputs<Season3FindPowerBankTaskOutput, Season3FindPowerBankTaskProblemTypes> = emptyTaskOutputs()
    outputs.output = {
      highwayTooFar: false,
      powerBanks: Array.from(foundPowerBankInfo.values()),
    }

    if (this.scoutRoutes.length <= 0) {
      outputs.output.highwayTooFar = true
      return outputs
    }

    const runningCreepInfo = roomResource.runningCreepInfo(this.identifier)
    outputs.spawnRequests.push(...this.spawnRequests(runningCreepInfo))

    roomResource.idleCreeps(this.identifier).forEach(creepInfo => {
      creepInfo.problems.forEach(problem => { // TODO: 処理できるものは処理する
        if (outputs.problems.some(stored => stored.identifier === problem.identifier) !== true) {
          outputs.problems.push(new UnexpectedProblem(problem))
        }
      })
      const creep = creepInfo.creep
      const routeIndex = creep.memory.ci == null ? null : parseInt(creep.memory.ci, 10)
      const creepTask = this.newScoutTask(creep.room.isHighway, routeIndex)
      if (creepTask != null) {
        const taskRequest: CreepTaskAssignTaskRequest = {
          taskType: "normal",
          task: creepTask
        }
        outputs.creepTaskAssignRequests.set(creep.name, taskRequest)
      }
    })

    return outputs
  }

  private refreshPowerBankInfo(): void {
    const roomNames = Object.keys(this.powerBankInfo)
    roomNames.forEach(roomName => {
      const powerBankInfo = this.powerBankInfo[roomName]
      if (powerBankInfo == null) {
        return
      }
      if (powerBankInfo.decayedBy < Game.time) {
        return
      }
      delete this.powerBankInfo[roomName]
    })
  }

  private foundPowerBankInfo(): Season3FindPowerBankTaskPowerBankInfo[] {
    const foundPowerBankInfo: Season3FindPowerBankTaskPowerBankInfo[] = []
    const checkedRooms = Object.values(this.powerBankInfo).map(info => info.roomName)

    this.observeTargetRooms.forEach(roomName => {
      if (checkedRooms.includes(roomName) === true) {
        return
      }
      const room = Game.rooms[roomName]
      if (room == null) {
        return
      }
      const powerBank = room.find(FIND_STRUCTURES).find(structure => structure.structureType === STRUCTURE_POWER_BANK) as StructurePowerBank | null
      if (powerBank == null) {
        return
      }

      const route = this.scoutRoutes.find(route => route.observeTargetRoomNames.includes(roomName) === true)
      if (route == null) {
        PrimitiveLogger.programError(`${this.identifier} no route for ${roomLink(roomName)} found`)
        return
      }

      const options: RoomPositionFilteringOptions = {
        excludeItself: true,
        excludeTerrainWalls: true,
        excludeStructures: true,
        excludeWalkableStructures: false,
      }
      const nearbySquareCount = powerBank.pos.positionsInRange(1, options).length

      foundPowerBankInfo.push({
        roomName,
        powerAmount: powerBank.power,
        decayedBy: Game.time + powerBank.ticksToDecay,
        nearbySquareCount,
        waypoints: route.routeToHighway,
      })
    })

    return foundPowerBankInfo
  }

  private spawnRequests(creepInfo: RunningCreepInfo[]): SpawnCreepTaskRequest[] {
    const creepCount = creepInfo.length
    const creepIdentifiers = this.creepIdentifiers.filter(identifier => creepInfo.some(info => info.creepIdentifier === `${identifier}`) !== true)
    const scoutInsufficiency = this.scoutRoutes.length - creepCount
    const requests: SpawnCreepTaskRequest[] = []

    for (let i = 0; i < scoutInsufficiency; i += 1) {
      const creepIdentifier = creepIdentifiers.shift() ?? null
      const initialTask = this.newScoutTask(false, creepIdentifier)
      requests.push(new SpawnCreepTaskRequest(
        SpawnTaskRequestPriority.Cancellable,
        this.codename,
        this.identifier,
        `${creepIdentifier}`,
        [MOVE],
        initialTask,
        0,
      ))
    }
    return requests
  }

  private newScoutTask(isInHighway: boolean, routeIndex: number | null): CreepTask | null {
    if (routeIndex == null || isNaN(routeIndex) === true) {
      return null
    }
    const route = this.scoutRoutes[routeIndex]
    if (route == null) {
      PrimitiveLogger.programError(`${this.constructor.name} cannot find route with index ${routeIndex}`)
      return null
    }

    const destinationRoomName = route.highwayRoute[route.highwayRoute.length - 1]
    if (destinationRoomName == null) {
      PrimitiveLogger.programError(`${this.constructor.name} no highway route found`)
      return null
    }
    const targetRoomNames = [...route.highwayRoute]
    if (isInHighway === true) {
      return ScoutRoomsTask.create(destinationRoomName, targetRoomNames)
    }

    const highwayEntrance = route.routeToHighway[route.routeToHighway.length - 1]
    if (highwayEntrance == null) {
      PrimitiveLogger.programError(`${this.constructor.name} no highway entrance found`)
      return ScoutRoomsTask.create(destinationRoomName, targetRoomNames)
    }

    const tasks: CreepTask[] = [
      MoveToRoomTask.create(highwayEntrance, [...route.routeToHighway]),
      ScoutRoomsTask.create(destinationRoomName, targetRoomNames)
    ]
    return SequentialTask.create(tasks)
  }

  // ---- Profit ---- //
  public estimate(): ObserveTaskPerformance {
    const numberOfScouts = this.scoutRoutes.length
    const scoutBody = [MOVE]

    const resourceCost = new Map<ResourceConstant, number>()
    resourceCost.set(RESOURCE_ENERGY, bodyCost(scoutBody) * numberOfScouts)

    return {
      periodType: "continuous",
      timeSpent: GameConstants.creep.life.lifeTime,
      spawnTime: numberOfScouts * scoutBody.length * GameConstants.creep.life.spawnTime,
      numberOfCreeps: numberOfScouts,
      resourceCost,
      observedRooms: this.observeTargetRooms.length,
    }
  }

  public performance(period: Timestamp): ObserveTaskPerformance {
    const timeSpent = Math.min(Game.time - this.startTime, period)
    return calculateObserveTaskPerformance(timeSpent, "continuous", this.performanceState)
  }

  // ---- CreepSpawnTaskEventHandler ---- //
  public didSpawnCreep(creepSpawnEvent: CreepSpawnTaskEvent): void {
    const spawnTime = bodyCost(creepSpawnEvent.body) * GameConstants.creep.life.spawnTime
    this.performanceState.s.push({
      t: Game.time,
      st: spawnTime,
    })
  }

  public didCancelSpawningCreep(creepSpawnEvent: CreepSpawnTaskEvent): void {
    // TODO:
  }
}

// TODO: 探索が未完成
function calculateRoomRoutes(roomName: RoomName): Season3FindPowerBankTaskScoutRoute[] | null {
  const roomCoordinate = RoomCoordinate.parse(roomName)
  if (roomCoordinate == null) {
    return null
  }
  const sector = new RoomSector(roomCoordinate)
  const highwayRoutes = sector.getNearestHighwayRoutes(roomName)

  const scoutRoutes: Season3FindPowerBankTaskScoutRoute[] = []

  const searchRange = 5
  const createRoomCoordinate = ((d: number, isVertical: boolean, coordinate: RoomCoordinate): RoomCoordinate => {
    const dx = isVertical ? 0 : d
    const dy = isVertical ? d : 0
    return RoomCoordinate
      .create(
        coordinate.direction,
        coordinate.x + dx,
        coordinate.y + dy,
      )
  })

  highwayRoutes.forEach(route => {
    const highwayRoomName = route[route.length - 1]
    if (highwayRoomName == null) {
      return
    }
    const roomCoordinate = RoomCoordinate.parse(highwayRoomName)
    if (roomCoordinate == null) {
      return
    }

    const isVertical = roomCoordinate.x % 10 === 0
    const scoutRoute: Season3FindPowerBankTaskScoutRoute = {
      routeToHighway: route,
      highwayRoute: [],
      observeTargetRoomNames: [highwayRoomName],
    }

    for (let i = -searchRange; i <= searchRange; i += 1) {
      const roomName = createRoomCoordinate(i, isVertical, roomCoordinate).roomName

      if (scoutRoute.observeTargetRoomNames.includes(roomName) === true) {
        continue
      }
      scoutRoute.observeTargetRoomNames.push(roomName)
      if (i === -searchRange || i === searchRange) {
        scoutRoute.highwayRoute.push(roomName)
      }
    }
    scoutRoutes.push(scoutRoute)
  })

  return scoutRoutes
}

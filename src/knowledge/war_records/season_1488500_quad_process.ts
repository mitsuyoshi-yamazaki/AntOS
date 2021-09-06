import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName } from "prototype/creep"
import { processLog } from "os/infrastructure/logger"
import { GameConstants, OBSTACLE_COST } from "utility/constants"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { MessageObserver } from "os/infrastructure/message_observer"
import { SourceKeeper } from "game/source_keeper"
import { moveToRoom } from "script/move_to_room"

interface QuadState {
  creepNames: CreepName[]
  moveToTarget: RoomName | RoomPositionState | null
}

let exitingDirection = null as TOP | BOTTOM | LEFT | RIGHT | null

/**
 * - [ ] TOP/RIGHT方向へ部屋移動する際に崩れる問題
 */
class Quad {
  public get numberOfCreeps(): number {
    return this.creeps.length
  }

  private creeps: Creep[] = []

  public constructor(
    creepNames: CreepName[],
    private readonly moveToTarget: RoomName | RoomPosition | null
  ) {
    creepNames.forEach(creepName => {
      const creep = Game.creeps[creepName]
      if (creep != null) {
        this.creeps.push(creep)
      }
    })
  }

  public inRoom(roomName: RoomName): boolean {
    return this.creeps.every(creep => (creep.room.name === roomName))
  }

  public moveToRoom(destinationRoomName: RoomName, waypoints: RoomName[]): void {
    const topRight = this.creeps[0]
    if (topRight == null) {
      return
    }

    if (this.isCloseToDestinationRoom(topRight.pos, topRight.room, destinationRoomName, waypoints) !== true) {
      moveToRoom(topRight, destinationRoomName, waypoints)
      this.follow()
      return
    }

    if (this.isSquadForm() !== true) {
      this.align()
      return
    }
    if (this.canMoveQquad() !== true) {
      return
    }
    if (topRight.room.name === destinationRoomName) {
      return
    }
    const nextPosition = moveToRoomQuad(topRight, destinationRoomName, waypoints)
    topRight.moveTo(nextPosition)
    this.moveFollowersToNextPosition(nextPosition, 1)
  }

  public moveQuadTo(position: RoomPosition, range: number): void {
    if (this.isSquadForm() !== true) {
      this.align()
      return
    }
    if (this.canMoveQquad() !== true) {
      return
    }

    const topRight = this.creeps[0]
    if (topRight == null) {
      return
    }
    if (topRight.pos.isEqualTo(position) === true) {
      topRight.say("ok")
      return
    }

    const pathFinderOptions: FindPathOpts = {
      costCallback: quadCostCallback,
      range,
      ignoreCreeps: true,
      maxRooms: 1,
    }

    const nextSteps = topRight.room.findPath(topRight.pos, position, pathFinderOptions) // Room間移動は対応していない
    if (nextSteps[0] == null) {
      topRight.say("no path")
      return
    }
    nextSteps.forEach((step, index) => {
      const p = new RoomPosition(step.x, step.y, topRight.room.name)
      topRight.room.visual.text(`${index}`, p, {color: "#ffffff"})
    })
    const nextPosition = new RoomPosition(nextSteps[0].x, nextSteps[0].y, topRight.room.name)
    topRight.moveTo(nextPosition)
    this.moveFollowersToNextPosition(nextPosition, 1)
  }

  private isCloseToDestinationRoom(position: RoomPosition, room: Room, destinationRoomName: RoomName, waypoints: RoomName[]): boolean {
    if (waypoints.length > 0) {
      return false
    }
    const exit = room.findExitTo(destinationRoomName)
    if (exit === ERR_NO_PATH || exit === ERR_INVALID_ARGS) {
      return false
    }

    const directionMap: { [index in ExitConstant]: TOP | BOTTOM | LEFT | RIGHT } = {
      1: TOP,     // FIND_EXIT_TOP
      3: RIGHT,   // FIND_EXIT_RIGHT
      5: BOTTOM,  // FIND_EXIT_BOTTOM
      7: LEFT,    // FIND_EXIT_LEFT
    }
    const directionToDestination = directionMap[exit]
    const nextRoomName = room.coordinate.neighbourRoom(directionToDestination)
    if (nextRoomName !== destinationRoomName) {
      return false
    }

    const threshold = 6
    switch (directionToDestination) {
    case TOP:
      return position.y < (GameConstants.room.edgePosition.min + threshold)
    case BOTTOM:
      return position.y > (GameConstants.room.edgePosition.max - threshold)
    case LEFT:
      return position.x < (GameConstants.room.edgePosition.min + threshold)
    case RIGHT:
      return position.x > (GameConstants.room.edgePosition.max - threshold)
    }
  }

  private align(): void {
    const topRight = this.creeps[0]
    if (topRight == null) {
      return
    }

    const topRightPosition = ((): RoomPosition => {
      switch (exitingDirection) {
      case LEFT: {
        const x = Math.min(Math.max(topRight.pos.x - 1, 0), 49)
        const y = Math.min(Math.max(topRight.pos.y, 1), 47)
        return new RoomPosition(x, y, topRight.pos.roomName)
      }
      case BOTTOM: {
        const x = Math.min(Math.max(topRight.pos.x, 2), 48)
        const y = Math.min(Math.max(topRight.pos.y + 1, 0), 49)
        return new RoomPosition(x, y, topRight.pos.roomName)
      }
      case TOP:
      case RIGHT:
      case null: {
        const x = Math.min(Math.max(topRight.pos.x, 2), 48)
        const y = Math.min(Math.max(topRight.pos.y, 1), 47)
        return new RoomPosition(x, y, topRight.pos.roomName)
      }
      }
    })()
    // topRight.say(`${topRightPosition.x},${topRightPosition.y}`)
    topRight.say("align")
    topRight.moveTo(topRightPosition)

    this.moveFollowersToNextPosition(topRightPosition, 2)
  }

  private canMove(): boolean {
    if (this.creeps.length <= 0) {
      return false
    }
    return this.creeps.every(creep => (creep.fatigue <= 0))
  }

  private canMoveQquad(): boolean {
    if (this.canMove() !== true) {
      return false
    }
    return this.isSquadForm()
  }

  private isSquadForm(): boolean {
    const topRight = this.creeps[0]
    if (topRight == null) {
      return false
    }

    const checkPosition = (creepIndex: number, directionFromTopRight: DirectionConstant): boolean => {
      const creep = this.creeps[creepIndex]
      if (creep == null) {
        return true
      }
      const position = topRight.pos.positionTo(directionFromTopRight)
      if (position == null || creep.pos.isEqualTo(position) !== true) {
        return false
      }
      return true
    }

    if (checkPosition(1, LEFT) !== true) {
      return false
    }
    if (checkPosition(2, BOTTOM) !== true) {
      return false
    }
    if (checkPosition(3, BOTTOM_LEFT) !== true) {
      return false
    }
    return true
  }

  private moveFollowersToNextPosition(nextPosition: RoomPosition, maxRooms: number): void {
    if (nextPosition.x <= 1) {
      if (exitingDirection !== RIGHT) {
        exitingDirection = LEFT
      }
    } else if (nextPosition.x >= 49) {
      exitingDirection = RIGHT
    } else if (nextPosition.y <= 0) {
      exitingDirection = TOP
    } else if (nextPosition.y >= 48) {
      if (exitingDirection !== TOP) {
        exitingDirection = BOTTOM
      }
    } else {
      exitingDirection = null
    }

    const move = (creepIndex: number, directionFromTopRight: DirectionConstant): void => {
      const creep = this.creeps[creepIndex]
      if (creep == null) {
        return
      }
      const position = nextPosition.positionTo(directionFromTopRight) ?? nextPosition.nextRoomPositionTo(directionFromTopRight)
      creep.moveTo(position, this.followerMoveToOptions(maxRooms))
    }

    move(1, LEFT)
    move(2, BOTTOM)
    move(3, BOTTOM_LEFT)
  }

  private follow(): void {
    const follow = (creepIndex: number): void => {
      const previousCreep = this.creeps[creepIndex - 1]
      const creep = this.creeps[creepIndex]
      if (previousCreep == null || creep == null) {
        return
      }
      creep.moveTo(previousCreep.pos, this.followerMoveToOptions(2))
    }

    follow(1)
    follow(2)
    follow(3)
  }

  private followerMoveToOptions(maxRooms: number): MoveToOpts {
    return {
      maxRooms,
      maxOps: 200,
      reusePath: 0,
    }
  }
}

export interface Season1488500QuadProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  targetRoomName: RoomName
  waypoints: RoomName[]
  destination: RoomPositionState | null
  quadState: QuadState
}

// Game.io("launch -l Season1488500QuadProcess room_name=W21S23 target_room_name=W22S22 waypoints=W22S23")
export class Season1488500QuadProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private destination: RoomPosition | null,
    private quadState: QuadState,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1488500QuadProcessState {
    return {
      t: "Season1488500QuadProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      targetRoomName: this.targetRoomName,
      waypoints: this.waypoints,
      destination: this.destination?.encode() ?? null,
      quadState: this.quadState,
    }
  }

  public static decode(state: Season1488500QuadProcessState): Season1488500QuadProcess {
    const destination = ((): RoomPosition | null => {
      if (state.destination == null) {
        return null
      }
      return decodeRoomPosition(state.destination)
    })()
    return new Season1488500QuadProcess(state.l, state.i, state.p, state.targetRoomName, state.waypoints, destination, state.quadState)
    // return new Season1488500QuadProcess(state.l, state.i, state.p, "W20S21", ["W20S23"], destination, state.quadState)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season1488500QuadProcess {
    const quadState: QuadState = {
      creepNames: [],
      moveToTarget: null,
    }
    return new Season1488500QuadProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, quadState)
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    return `${roomLink(this.parentRoomName)} => ${this.targetRoomName} ${creepCount}cr`
  }

  public didReceiveMessage(message: string): string {
    const [rawX, rawY] = message.split(" ")
    if (rawX == null || rawY == null) {
      return `Invalid format. Expected: "x y" (${message})`
    }
    const x = parseInt(rawX, 10)
    const y = parseInt(rawY, 10)
    if (isNaN(x) === true || isNaN(y) === true) {
      return `Invalid format. Position is not a number ${message}`
    }
    try {
      this.destination = new RoomPosition(x, y, this.targetRoomName)
    } catch (e) {
      return `Failed: ${e}`
    }
    return "ok"
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    creeps.forEach(creep => {
      if (this.quadState.creepNames.includes(creep.name) !== true) {
        this.quadState.creepNames.push(creep.name)
      }
    })

    const creepInsufficiency = 4 - this.quadState.creepNames.length
    if (creepInsufficiency > 0) {
      const room = Game.rooms[this.parentRoomName]
      if (room == null) {
        PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      } else {
        const priority: CreepSpawnRequestPriority = CreepSpawnRequestPriority.High //this.quadState.creepNames.length <= 0 ? CreepSpawnRequestPriority.Low : CreepSpawnRequestPriority.High
        this.requestCreep(priority, creepInsufficiency)
      }
    }

    if (this.quadState.creepNames.length > 0) {
      const moveToTarget = ((): RoomName | RoomPosition | null => {
        if (this.quadState.moveToTarget == null) {
          return null
        }
        if (typeof this.quadState.moveToTarget === "string") {
          return this.quadState.moveToTarget
        }
        return decodeRoomPosition(this.quadState.moveToTarget)
      })()
      const quad = new Quad(this.quadState.creepNames, moveToTarget)
      if (quad.numberOfCreeps > 0) {
        this.runQuad(quad)
        return
      }
      processLog(this, "Quad dead")
      return
    }
  }

  private requestCreep(priority: CreepSpawnRequestPriority, numberOfCreeps: number): void {
    // const body = ((): BodyPartConstant[] => {
    //   switch (numberOfCreeps) {
    //   case 4:
    //     return [ATTACK, MOVE]
    //   case 3:
    //     return [RANGED_ATTACK, MOVE]
    //   case 2:
    //     return [WORK, MOVE]
    //   default:
    //     return [TOUGH, MOVE]
    //   }
    // })()

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps,
      codename: this.codename,
      roles: [CreepRole.Mover],
      body: [MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runQuad(quad: Quad): void {
    if (this.destination != null) {
      quad.moveQuadTo(this.destination, 0)
      return
    }

    if (quad.inRoom(this.targetRoomName) !== true) {
      quad.moveToRoom(this.targetRoomName, this.waypoints)
      return
    }
  }
}

function quadCostCallback(roomName: RoomName, costMatrix: CostMatrix): CostMatrix {
  const room = Game.rooms[roomName]
  if (room == null) {
    return costMatrix
  }
  // for (let y = 0; y <= GameConstants.room.edgePosition.max; y += 1) { // FixMe:
  //   for (let x = 0; x <= GameConstants.room.edgePosition.max; x += 1) {
  //     room.visual.text(`${costMatrix.get(x, y)}`, x, y)
  //   }
  // }

  if (room.roomType === "source_keeper") {
    const roomPositionFilteringOptions: RoomPositionFilteringOptions = {
      excludeItself: false,
      excludeTerrainWalls: false,
      excludeStructures: false,
      excludeWalkableStructures: false,
    }
    const sourceKeepers = room.find(FIND_HOSTILE_CREEPS)
      .filter(creep => creep.owner.username === SourceKeeper.username)
    const positionsToAvoid = sourceKeepers
      .flatMap(creep => creep.pos.positionsInRange(5, roomPositionFilteringOptions))

    positionsToAvoid.forEach(position => {
      // creepRoom.visual.text("x", position.x, position.y, { align: "center", color: "#ff0000" })
      costMatrix.set(position.x, position.y, OBSTACLE_COST)
    })
  }

  const obstacleDirections: DirectionConstant[] = [
    TOP,
    TOP_RIGHT,
    RIGHT,
  ]
  const getObstaclePositions = (position: RoomPosition): RoomPosition[] => {
    return obstacleDirections.flatMap(direction => position.positionTo(direction) ?? [])
  }
  const swampCost = GameConstants.pathFinder.costs.swamp
  const obstacleCost = GameConstants.pathFinder.costs.obstacle
  const walkableStructures: StructureConstant[] = [
    STRUCTURE_CONTAINER,
    STRUCTURE_ROAD,
  ]

  for (let y = 0; y <= GameConstants.room.edgePosition.max; y += 1) {
    for (let x = 0; x <= GameConstants.room.edgePosition.max; x += 1) {
      const position = new RoomPosition(x, y, roomName)
      const terrain = position.lookFor(LOOK_TERRAIN)[0]
      switch (terrain) {
      case "plain": {
        const isObstacle = position.lookFor(LOOK_STRUCTURES).some(structure => (walkableStructures.includes(structure.structureType) !== true))
        if (isObstacle === true) {
          costMatrix.set(x, y, obstacleCost)
          getObstaclePositions(position).forEach(p => {
            costMatrix.set(p.x, p.y, obstacleCost)
          })
        }
        break
      }
      case "swamp": {
        const isObstacle = position.lookFor(LOOK_STRUCTURES).some(structure => (walkableStructures.includes(structure.structureType) !== true))
        if (isObstacle === true) {
          costMatrix.set(x, y, obstacleCost)
          getObstaclePositions(position).forEach(p => {
            costMatrix.set(p.x, p.y, obstacleCost)
          })
        } else {
          getObstaclePositions(position).forEach(p => {
            costMatrix.set(x, y, swampCost)
            if (costMatrix.get(p.x, p.y) < swampCost) {
              costMatrix.set(p.x, p.y, swampCost)
            }
          })
        }
        break
      }
      case "wall":
        costMatrix.set(x, y, obstacleCost)
        getObstaclePositions(position).forEach(p => {
          costMatrix.set(p.x, p.y, obstacleCost)
        })
        break
      default:
        break
      }
    }
  }

  return costMatrix
}

function moveToRoomQuad(creep: Creep, targetRoomName: RoomName, waypoints: RoomName[]): RoomPosition {
  try {
    const creepRoom = creep.room

    if (creep.pos.x === 0) {
      return creep.pos.positionTo(RIGHT) ?? creep.pos
    } else if (creep.pos.x === 49) {
      return creep.pos.positionTo(LEFT) ?? creep.pos
    } else if (creep.pos.y === 0) {
      return creep.pos.positionTo(BOTTOM) ?? creep.pos
    } else if (creep.pos.y === 49) {
      return creep.pos.positionTo(TOP) ?? creep.pos
    }

    if (creepRoom.name === targetRoomName) {
      return creep.pos
    }

    const destinationRoomName = ((): RoomName => {
      const nextWaypoint = waypoints[0]
      if (nextWaypoint == null) {
        return targetRoomName
      }
      if (nextWaypoint === creepRoom.name) {
        waypoints.shift()
        return waypoints[0] ?? targetRoomName
      }
      return nextWaypoint
    })()

    const pathFinderOptions: FindPathOpts = {
      costCallback: quadCostCallback,
      ignoreCreeps: true,
      maxRooms: 1,
    }

    const exit = creepRoom.findExitTo(destinationRoomName)
    if (exit === ERR_NO_PATH) {
      creep.say("no exit")
      return creep.pos
    } else if (exit === ERR_INVALID_ARGS) {
      creep.say("invalid")
      PrimitiveLogger.fatal(`Room.findExitTo() returns ERR_INVALID_ARGS (${exit}), room ${roomLink(creepRoom.name)} to ${roomLink(destinationRoomName)}`)
      return creep.pos
    }

    const exitFlag = creepRoom.find(FIND_FLAGS).find(flag => {
      switch (exit) {
      case FIND_EXIT_TOP:
        if (flag.pos.y === GameConstants.room.edgePosition.min) {
          return true
        }
        break
      case FIND_EXIT_BOTTOM:
        if (flag.pos.y === GameConstants.room.edgePosition.max) {
          return true
        }
        break
      case FIND_EXIT_LEFT:
        if (flag.pos.x === GameConstants.room.edgePosition.min) {
          return true
        }
        break
      case FIND_EXIT_RIGHT:
        if (flag.pos.x === GameConstants.room.edgePosition.max) {
          return true
        }
        break
      default:
        break
      }
      return false
    })

    const exitPosition = exitFlag?.pos ?? creep.pos.findClosestByPath(exit, pathFinderOptions)
    if (exitPosition == null) {
      creep.say("no path1")
      return creep.pos
    }

    const nextSteps = creep.room.findPath(creep.pos, exitPosition, pathFinderOptions) // Room間移動は対応していない
    if (nextSteps[0] == null) {
      creep.say("no path2")
      return creep.pos
    }
    nextSteps.forEach((step, index) => {  // FixMe: デバッグコード
      const p = new RoomPosition(step.x, step.y, creep.room.name)
      creep.room.visual.text(`${index}`, p, { color: "#ffffff" })
    })
    return new RoomPosition(nextSteps[0].x, nextSteps[0].y, creep.room.name)
  } catch (e) {
    PrimitiveLogger.programError(`moveToRoomQuad() failed: ${e}`)
    creep.say("error")
    return creep.pos
  }
}

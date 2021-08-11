import { SourceKeeper } from "game/source_keeper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName, isAnyCreep } from "prototype/creep"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { moveToRoom } from "script/move_to_room"
import { GameConstants, oppositeDirection } from "utility/constants"
import { CreepBody } from "utility/creep_body"
import { roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { oppositeDirections } from "utility/direction"
import { State, Stateful } from "os/infrastructure/state"
import { ErrorMapper } from "error_mapper/ErrorMapper"

const showPath = true as boolean

type Direction = TOP | BOTTOM | LEFT | RIGHT
const oppositeDirectionMap: { [index in Direction]: Direction } = {
  1: BOTTOM,
  5: TOP,
  7: RIGHT,
  3: LEFT,
}
function isOppositeDirection(direction1: Direction, direction2: Direction): boolean {
  return oppositeDirectionMap[direction1] === direction2
}
const rotateDirectionMap: { [index in Direction]: { [index in Direction]?: "left" | "right" } } = {
  1: { 7: "left", 3: "right" }, // TOP
  5: { 3: "left", 7: "right" }, // BOTTOM
  7: { 5: "left", 1: "right" }, // LEFT
  3: { 1: "left", 5: "right" }, // RIGHT
}
function rotateDirection(fromDirection: Direction, toDirection: Direction): "left" | "right" | null {
  return rotateDirectionMap[fromDirection][toDirection] ?? null
}
function rotationFor(fromDirection: Direction, toDirection: Direction): "left" | "right" | "turn" | null {
  if (isOppositeDirection(fromDirection, toDirection) === true) {
    return "turn"
  }
  return rotateDirection(fromDirection, toDirection)
}

type MoveToRoomStatus = "in progress" | "close to room exit" | "close to destination"
export type QuadAttackTargetType = AnyCreep | AnyStructure
type QuadFollowerDirection = LEFT | BOTTOM_LEFT | BOTTOM

type StayQuadTask = {
  taskType: "stay"
}
type MoveToRoomQuadTask = {
  taskType: "move to room"
  roomName: RoomName
  waypoints: RoomName[]
  quadFormed: boolean
}
type MoveToQuadTask = {
  taskType: "move to"
  position: RoomPosition
  range: number
}
type FleeQuadTask = {
  taskType: "flee"
  position: RoomPosition
  range: number
}
type FormQuadTask = {
  taskType: "form"
}
type RotateQuadTask = {
  taskType: "rotate"
  direction: Direction
}

type MoveQuadTask = StayQuadTask | MoveToRoomQuadTask | MoveToQuadTask | FleeQuadTask | FormQuadTask | RotateQuadTask

export interface QuadState extends State {
  t: "Quad"

  lastLeaderPosition: RoomPosition
  direction: Direction
  exitingDirection: Direction | null
  leaderName: CreepName
  followerNames: CreepName[]
}

interface QuadInterface {
  // ---- Property ---- //
  numberOfCreeps: number
  pos: RoomPosition
  room: Room
  damage: number
  damagePercent: number
  minTicksToLive: number

  // ---- Position ---- //
  inRoom(roomName: RoomName): boolean
  getMinRangeTo(position: RoomPosition): number
  getMaxRangeTo(position: RoomPosition): number
  isQuadForm(): boolean

  // ---- Member ---- //
  addCreep(creep: Creep): void
  includes(creepName: CreepName): boolean

  // ---- Action ---- //
  say(message: string): void

  // ---- Move ---- //
  moveToRoom(roomName: RoomName, waypoints: RoomName[], quadFormed?: boolean): void
  moveTo(position: RoomPosition, range: number): void
  fleeFrom(position: RoomPosition, range: number): void
  keepQuadForm(): void

  // ---- Attack ---- //
  heal(targets?: AnyCreep[]): void
  attack(mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[]): void
  passiveAttack(targets: QuadAttackTargetType[]): void

  // ---- Execution ---- //
  run(): void
}

/**
 * - [ ] attack()時にrotate
 * - [ ] attack()時にattack(), dismantle()
 * - [ ] 近所にAttackerが来たら避ける
 */
export class Quad implements Stateful, QuadInterface {
  public get pos(): RoomPosition {
    return this.leaderCreep.pos
  }
  public get room(): Room {
    return this.leaderCreep.room
  }
  public get numberOfCreeps(): number {
    return this.creeps.length
  }
  public get damage(): number {
    return this.creeps.reduce((result, current) => {
      return result + (current.hitsMax - current.hits)
    }, 0)
  }
  public get damagePercent(): number {
    let maxHits = 0
    let hits = 0
    this.creeps.forEach(creep => {
      maxHits += creep.hitsMax
      hits += creep.hits
    })
    return (maxHits - hits) / maxHits
  }
  public get minTicksToLive(): number {
    const max = GameConstants.creep.life.lifeTime
    const minCreep = this.creeps.sort((lhs, rhs) => {
      return (lhs.ticksToLive ?? max) - (rhs.ticksToLive ?? max)
    })[0]

    if (minCreep == null) {
      return 0
    }
    return minCreep.ticksToLive ?? max
  }

  private get creeps(): Creep[] {
    return [
      this.leaderCreep,
      ...this.followerCreeps,
    ]
  }
  private moveTask: MoveQuadTask = {
    taskType: "stay",
  }

  private constructor(
    private lastLeaderPosition: RoomPosition,
    private direction: Direction,
    private exitingDirection: Direction | null,
    private leaderCreep: Creep,
    private readonly followerCreeps: Creep[],
  ) {
    this.lastLeaderPosition = this.pos
  }

  public encode(): QuadState {
    return {
      t: "Quad",
      lastLeaderPosition: this.lastLeaderPosition,
      direction: this.direction,
      exitingDirection: this.exitingDirection,
      leaderName: this.leaderCreep.name,
      followerNames: this.followerCreeps.map(creep => creep.name),
    }
  }

  public static decode(state: QuadState): Quad | null {
    const followerCreeps = state.followerNames.flatMap(creepName => Game.creeps[creepName] ?? [])
    const leader = ((): Creep | null => {
      const stored = Game.creeps[state.leaderName]
      if (stored != null) {
        return stored
      }
      return followerCreeps.shift() ?? null
    })()
    if (leader == null) {
      return null
    }
    return new Quad(state.lastLeaderPosition, state.direction, state.exitingDirection ?? null, leader, followerCreeps)
  }

  public static create(leaderCreep: Creep, followerCreeps: Creep[]): Quad | null {
    return new Quad(leaderCreep.pos, TOP, null, leaderCreep, followerCreeps)
  }

  // ---- Position ---- //
  public inRoom(roomName: RoomName): boolean {
    return this.creeps.every(creep => (creep.room.name === roomName))
  }

  public getMinRangeTo(position: RoomPosition): number {
    return this.creeps
      .map(creep => creep.pos.getRangeTo(position))
      .sort((lhs, rhs) => lhs - rhs)[0] ?? 0
  }

  public getMaxRangeTo(position: RoomPosition): number {
    return this.creeps
      .map(creep => creep.pos.getRangeTo(position))
      .sort((lhs, rhs) => rhs - lhs)[0] ?? 0
  }

  public isQuadForm(): boolean {
    const checkPosition = (creepIndex: number, directionFromTopRight: DirectionConstant): boolean => {
      const creep = this.creeps[creepIndex]
      if (creep == null) {
        return true
      }
      const position = this.pos.positionTo(directionFromTopRight)
      if (position == null || creep.pos.isEqualTo(position) !== true) {
        return false
      }
      return true
    }

    if (checkPosition(1, this.absoluteQuadFollowerDirection(BOTTOM)) !== true) {
      return false
    }
    if (checkPosition(2, this.absoluteQuadFollowerDirection(LEFT)) !== true) {
      return false
    }
    if (checkPosition(3, this.absoluteQuadFollowerDirection(BOTTOM_LEFT)) !== true) {
      return false
    }
    return true
  }

  // ---- Member ---- //
  public addCreep(creep: Creep): void {
    if (this.leaderCreep.getActiveBodyparts(WORK) > 0 || this.leaderCreep.getActiveBodyparts(ATTACK) > 0) {
      this.followerCreeps.push(creep)
      return
    }
    if (creep.getActiveBodyparts(WORK) <= 0 && creep.getActiveBodyparts(ATTACK) <= 0) {
      this.followerCreeps.push(creep)
      return
    }
    const previousLeader = this.leaderCreep
    this.leaderCreep = creep
    this.followerCreeps.push(previousLeader)
  }

  public includes(creepName: CreepName): boolean {
    return this.creeps.some(creep => creep.name === creepName)
  }

  // ---- Action ---- //
  public say(message: string): void {
    this.creeps[0]?.say(message)
  }

  // ---- Move ---- //
  public moveToRoom(destinationRoomName: RoomName, waypoints: RoomName[], quadFormed?: boolean): void {
    this.moveTask = {
      taskType: "move to room",
      roomName: destinationRoomName,
      waypoints: waypoints,
      quadFormed: quadFormed ?? false,
    }
  }

  /**
 * @param range 全てのCreepがこのrangeに入る
 */
  public moveTo(position: RoomPosition, range: number): void {
    switch (this.moveTask.taskType) {
    case "rotate":
      if (this.isQuadForm() === true) {
        return
      }
      break
    default:
      break
    }

    this.moveTask = {
      taskType: "move to",
      position,
      range,
    }
  }

  public fleeFrom(position: RoomPosition, range: number): void {
    this.moveTask = {
      taskType: "flee",
      position,
      range,
    }
  }

  public keepQuadForm(): void {
    this.moveTask = {
      taskType: "form"
    }
  }

  private rotateTo(target: QuadAttackTargetType): void {
    if (target.room == null || this.room.name !== target.room.name) {
      return
    }
    switch (this.moveTask.taskType) {
    case "flee":
      return
    default:
      break
    }
    if (this.canMoveQquad() !== true) {
      return
    }
    const direction = this.directionTo(target)
    if (direction == null || direction === this.direction) {
      return
    }

    this.moveTask = {
      taskType: "rotate",
      direction,
    }
  }

  private directionTo(target: QuadAttackTargetType): Direction | null {
    const neighbourPositions = target.pos.positionsInRange(1, {
      excludeItself: true,
      excludeStructures: true,
      excludeTerrainWalls: true,
      excludeWalkableStructures: false,
    })
    const availableDirections: Direction[] = []
    const availablePositionsForDirection: [Direction, DirectionConstant, DirectionConstant][] = [
      [BOTTOM, TOP_LEFT, TOP],
      [BOTTOM, TOP, TOP_RIGHT],
      [LEFT, TOP_RIGHT, RIGHT],
      [LEFT, RIGHT, BOTTOM_RIGHT],
      [TOP, BOTTOM_RIGHT, BOTTOM],
      [TOP, BOTTOM, BOTTOM_LEFT],
      [RIGHT, BOTTOM_LEFT, LEFT],
      [RIGHT, LEFT, TOP_LEFT],
    ]
    availablePositionsForDirection.forEach(([targetDirection, direction1, direction2]) => {
      const position1 = target.pos.positionTo(direction1)
      const position2 = target.pos.positionTo(direction2)
      if (position1 == null || position2 == null) {
        return
      }
      if (neighbourPositions.every(position => position.isEqualTo(position1) !== true)) {
        return
      }
      if (neighbourPositions.every(position => position.isEqualTo(position2) !== true)) {
        return
      }
      availableDirections.push(targetDirection)
    })
    const rawDirection = this.rawDirectionTo(target.pos)
    if (availableDirections.includes(rawDirection) === true) {
      return rawDirection
    }
    return availableDirections[0] ?? null
  }

  private rawDirectionTo(position: RoomPosition): Direction {
    const dx = position.x - this.leaderCreep.pos.x
    const dy = position.y - this.leaderCreep.pos.y
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        return RIGHT
      } else {
        return LEFT
      }
    } else {
      if (dy > 0) {
        return BOTTOM
      } else {
        return TOP
      }
    }
  }

  // ---- Execution ---- //
  public run(): void {
    // this.followerCreeps[0]?.say(this.moveTask.taskType)
    switch (this.moveTask.taskType) {
    case "move to room":
      this.runMoveToRoom(this.moveTask.roomName, this.moveTask.waypoints, this.moveTask.quadFormed)
      break
    case "move to":
      this.runMoveTo(this.moveTask.position, this.moveTask.range)
      break
    case "flee":
      this.runFleeFrom(this.moveTask.position, this.moveTask.range)
      break
    case "form":
      this.runKeepQuadForm()
      break
    case "stay":
      break
    case "rotate":
      this.runRotateTask(this.moveTask.direction)
      break
    default:
      PrimitiveLogger.programError(`Quad.run() uninplemented move task ${this.moveTask}`)
      break
    }
  }

  private runMoveToRoom(destinationRoomName: RoomName, waypoints: RoomName[], quadFormed: boolean): void {
    if (quadFormed !== true) {
      const status = this.getMoveToRoomStatus(this.pos, this.room, destinationRoomName, waypoints)
      switch (status) {
      case "in progress":
        moveToRoom(this.leaderCreep, destinationRoomName, waypoints, 1)
        this.follow()
        return

      case "close to room exit": {
        const quadRange = this.getMaxRangeTo(this.pos)
        if (quadRange != null && quadRange <= 5) {
          moveToRoom(this.leaderCreep, destinationRoomName, waypoints, 1)
        }
        this.follow()
        return
      }

      case "close to destination":
        break
      }
    }

    if (this.isQuadForm() !== true) {
      this.align()
      return
    }
    if (this.canMoveQquad() !== true) {
      return
    }
    if (this.room.name === destinationRoomName) {
      return
    }
    const nextPosition = moveToRoomQuad(this.leaderCreep, destinationRoomName, waypoints, this.creeps.map(creep => creep.name), this.direction)
    this.leaderCreep.moveTo(nextPosition)
    this.moveFollowersToNextPosition(nextPosition, 1)
  }

  /**
   * @param range 全てのCreepがこのrangeに入る
   */
  private runMoveTo(position: RoomPosition, range: number): void {
    if (this.isQuadForm() !== true) {
      this.align()
      return
    }
    if (this.canMoveQquad() !== true) {
      return
    }

    const maxRange = this.getMinRangeTo(position)
    if (maxRange <= range) {
      return
    }

    const pathFinderOptions: FindPathOpts = {
      costCallback: quadCostCallback(this.creeps.map(creep => creep.name), this.direction),
      range: 0,
      ignoreCreeps: true,
      maxRooms: 1,
    }

    const nextSteps = this.room.findPath(this.pos, position, pathFinderOptions) // Room間移動は対応していない
    if (nextSteps[0] == null) {
      this.say("no path")
      return
    }
    if (showPath === true) {
      nextSteps.forEach((step, index) => {
        const p = new RoomPosition(step.x, step.y, this.room.name)
        this.room.visual.text(`${index}`, p, { color: "#ffffff" })
      })
    }
    const nextPosition = new RoomPosition(nextSteps[0].x, nextSteps[0].y, this.room.name)
    this.leaderCreep.moveTo(nextPosition)
    this.moveFollowersToNextPosition(nextPosition, 1)
  }

  private runFleeFrom(position: RoomPosition, range: number): void {
    if (this.isQuadForm() !== true) {
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
    const minRange = this.getMinRangeTo(position)
    if (minRange >= range) {
      return
    }

    const fleePath = PathFinder.search(topRight.pos, { pos: position, range: range + 2 }, { flee: true, maxRooms: 1 })
    const fleePosition = fleePath.path[fleePath.path.length - 1]
    if (fleePosition == null) {
      this.say("no f-path")
      return
    }

    const pathFinderOptions: FindPathOpts = {
      costCallback: quadCostCallback(this.creeps.map(creep => creep.name), this.direction),
      range: 0,
      ignoreCreeps: true,
      maxRooms: 1,
    }

    const nextSteps = topRight.room.findPath(topRight.pos, fleePosition, pathFinderOptions) // Room間移動は対応していない
    if (nextSteps[0] == null) {
      topRight.say("no path")
      return
    }
    if (showPath === true) {
      nextSteps.forEach((step, index) => {
        const p = new RoomPosition(step.x, step.y, topRight.room.name)
        topRight.room.visual.text(`${index}`, p, { color: "#ffffff" })
      })
    }
    const nextPosition = new RoomPosition(nextSteps[0].x, nextSteps[0].y, topRight.room.name)
    topRight.moveTo(nextPosition)
    this.moveFollowersToNextPosition(nextPosition, 1)
  }

  private runKeepQuadForm(): void {
    if (this.isQuadForm() !== true) {
      this.align()
      return
    }
  }

  private runRotateTask(direction: Direction): void {
    if (this.isQuadForm() !== true) {
      PrimitiveLogger.programError(`Quad.runRotateTask() not quad formed ${roomLink(this.room.name)}`)
      return
    }
    const rotation = rotationFor(this.direction, direction)
    if (rotation == null) {
      return
    }
    this.rotateToDirection(rotation, direction)
  }

  private rotateToDirection(rotation: "left" | "right" | "turn", toDirection: Direction): void {
    const leaderNextPosition = ((): RoomPosition | null => {
      switch (rotation) {
      case "left":
        return this.leaderCreep.pos.positionTo(this.absoluteQuadFollowerDirection(LEFT))
      case "right":
        return this.leaderCreep.pos.positionTo(this.absoluteQuadFollowerDirection(BOTTOM))
      case "turn":
        return this.leaderCreep.pos.positionTo(this.absoluteQuadFollowerDirection(BOTTOM_LEFT))
      }
    })()
    if (leaderNextPosition == null) {
      this.leaderCreep.say("no pos")
      return
    }
    this.leaderCreep.say(`r-${rotation}`)
    this.direction = toDirection
    this.align(leaderNextPosition)
  }

  private absoluteQuadFollowerDirection(direction: QuadFollowerDirection): DirectionConstant {
    switch (this.direction) {
    case TOP:
      return direction
    case BOTTOM:
      switch (direction) {
      case LEFT: return RIGHT
      case BOTTOM_LEFT: return TOP_RIGHT
      case BOTTOM: return TOP
      }
    // eslint-disable-next-line no-fallthrough
    case LEFT:
      switch (direction) {
      case LEFT: return BOTTOM
      case BOTTOM_LEFT: return BOTTOM_RIGHT
      case BOTTOM: return RIGHT
      }
    // eslint-disable-next-line no-fallthrough
    case RIGHT:
      switch (direction) {
      case LEFT: return TOP
      case BOTTOM_LEFT: return TOP_LEFT
      case BOTTOM: return LEFT
      }
    }
  }

  private absoluteQuadDirection(direction: Direction): Direction {
    switch (this.direction) {
    case TOP:
      return direction
    case BOTTOM:
      switch (direction) {
      case TOP: return this.direction
      case LEFT: return RIGHT
      case RIGHT: return LEFT
      case BOTTOM: return TOP
      }
      // eslint-disable-next-line no-fallthrough
    case LEFT:
      switch (direction) {
      case TOP: return this.direction
      case LEFT: return BOTTOM
      case RIGHT: return TOP
      case BOTTOM: return RIGHT
      }
      // eslint-disable-next-line no-fallthrough
    case RIGHT:
      switch (direction) {
      case TOP: return this.direction
      case LEFT: return TOP
      case RIGHT: return BOTTOM
      case BOTTOM: return LEFT
      }
    }
  }

  private getMoveToRoomStatus(position: RoomPosition, room: Room, destinationRoomName: RoomName, waypoints: RoomName[]): MoveToRoomStatus {
    if (position.roomName === destinationRoomName) {
      return "close to destination"
    }

    const currentDestination = waypoints[0] ?? destinationRoomName
    const exit = room.findExitTo(currentDestination)
    if (exit === ERR_NO_PATH || exit === ERR_INVALID_ARGS) {
      return "in progress"
    }

    const directionMap: { [index in ExitConstant]: TOP | BOTTOM | LEFT | RIGHT } = {
      1: TOP,     // FIND_EXIT_TOP
      3: RIGHT,   // FIND_EXIT_RIGHT
      5: BOTTOM,  // FIND_EXIT_BOTTOM
      7: LEFT,    // FIND_EXIT_LEFT
    }
    const exitDirection = directionMap[exit]
    const nextRoomName = room.coordinate.neighbourRoom(exitDirection)

    const threshold = 4
    switch (exitDirection) {
    case TOP:
      if (position.y > (GameConstants.room.edgePosition.min + threshold)) {
        return "in progress"
      }
      return (nextRoomName === destinationRoomName) ? "close to destination" : "close to room exit"
    case BOTTOM:
      if (position.y < (GameConstants.room.edgePosition.max - threshold)) {
        return "in progress"
      }
      return (nextRoomName === destinationRoomName) ? "close to destination" : "close to room exit"
    case LEFT:
      if (position.x > (GameConstants.room.edgePosition.min + threshold)) {
        return "in progress"
      }
      return (nextRoomName === destinationRoomName) ? "close to destination" : "close to room exit"
    case RIGHT:
      if (position.x < (GameConstants.room.edgePosition.max - threshold)) {
        return "in progress"
      }
      return (nextRoomName === destinationRoomName) ? "close to destination" : "close to room exit"
    }
  }

  private align(leaderNextPosition?: RoomPosition): void {
    const leaderAvoidEdgePosition = ((): RoomPosition => {
      const result = ErrorMapper.wrapLoop((): RoomPosition => {
        const exitPosition = this.quadExitPosition()
        const x = Math.min(Math.max(this.leaderCreep.pos.x, exitPosition.minX + 1), exitPosition.maxX - 1)
        const y = Math.min(Math.max(this.leaderCreep.pos.y, exitPosition.minY + 1), exitPosition.maxY - 1)
        return new RoomPosition(x, y, this.leaderCreep.pos.roomName)
      }, "leaderAvoidEdgePosition")()
      if (result == null) {
        return this.leaderCreep.pos
      }
      return result
    })()

    const hasObstacle = (position: RoomPosition): boolean => {
      switch (getFieldType(position, this.creeps.map(creep => creep.name))) {
      case "plain":
      case "swamp":
        return false
      case "obstacle":
        return true
      }
    }

    const leaderPosition = ((): RoomPosition => {
      if (this.leaderCreep.pos.isEqualTo(leaderAvoidEdgePosition) !== true) {
        if (hasObstacle(leaderAvoidEdgePosition) === true) {
          const leaderAvoidObstaclePosition = leaderAvoidEdgePosition.positionTo(this.absoluteQuadDirection(RIGHT))
          if (leaderAvoidObstaclePosition != null) {
            this.leaderCreep.say("avoid-o1")
            this.leaderCreep.moveTo(leaderAvoidObstaclePosition)
            return leaderAvoidObstaclePosition
          }
        }
        this.leaderCreep.say("avoid-e")
        this.leaderCreep.moveTo(leaderAvoidEdgePosition)
        return leaderAvoidEdgePosition
      }

      const followerDirections: QuadFollowerDirection[] = [
        LEFT,
        BOTTOM_LEFT,
        BOTTOM,
      ]
      for (const positionDirection of followerDirections) {
        const absoluteDirection = this.absoluteQuadFollowerDirection(positionDirection)
        const followerPosition = this.leaderCreep.pos.positionTo(absoluteDirection)
        if (followerPosition == null) {
          continue
        }
        if (hasObstacle(followerPosition) === true) {
          const direction = oppositeDirections(absoluteDirection)[Game.time % 3] ?? oppositeDirection(absoluteDirection)
          const leaderAvoidObstaclePosition = leaderAvoidEdgePosition.positionTo(direction)
          if (leaderAvoidObstaclePosition != null) {
            this.leaderCreep.say("avoid-o2")
            this.leaderCreep.move(direction)
            return leaderAvoidObstaclePosition
          }
        }
      }

      if (leaderNextPosition != null) {
        this.leaderCreep.say("rotate")
        this.leaderCreep.moveTo(leaderNextPosition)
        return leaderNextPosition
      }
      this.leaderCreep.say("align")
      return this.leaderCreep.pos
    })()

    this.moveFollowersToNextPosition(leaderPosition, 2)
  }

  private canMove(): boolean {
    if (this.creeps.length <= 0) {
      return false
    }
    return this.creeps.every(creep => (creep.fatigue <= 0))
  }

  public canMoveQquad(): boolean {
    if (this.canMove() !== true) {
      return false
    }
    return this.isQuadForm()
  }

  private moveFollowersToNextPosition(nextPosition: RoomPosition, maxRooms: number): void {
    if (this.exitingDirection == null) {
      const exitPosition = this.quadExitPosition()
      if (nextPosition.x <= exitPosition.minX) {
        this.exitingDirection = LEFT
      } else if (nextPosition.x >= exitPosition.maxX) {
        this.exitingDirection = RIGHT
      } else if (nextPosition.y <= exitPosition.minY) {
        this.exitingDirection = TOP
      } else if (nextPosition.y >= exitPosition.maxY) {
        this.exitingDirection = BOTTOM
      } else {
        this.exitingDirection = null
      }
    }

    const move = (creepIndex: number, directionFromTopRight: DirectionConstant): void => {
      const creep = this.creeps[creepIndex]
      if (creep == null) {
        return
      }
      const position = nextPosition.positionTo(directionFromTopRight) ?? nextPosition.nextRoomPositionTo(directionFromTopRight)
      creep.moveTo(position, this.followerMoveToOptions(maxRooms))
    }

    move(1, this.absoluteQuadFollowerDirection(BOTTOM))
    move(2, this.absoluteQuadFollowerDirection(LEFT))
    move(3, this.absoluteQuadFollowerDirection(BOTTOM_LEFT))
  }

  /** quad.posがかかったら部屋移動が起きる位置 */
  private quadExitPosition(): { minX: number, maxX: number, minY: number, maxY: number } {
    const min = GameConstants.room.edgePosition.min
    const max = GameConstants.room.edgePosition.max
    switch (this.direction) {
    case TOP:
      return {
        minX: min + 1,
        maxX: max,
        minY: min,
        maxY: max - 1,
      }
    case RIGHT:
      return {
        minX: min + 1,
        maxX: max,
        minY: min + 1,
        maxY: max,
      }
    case BOTTOM:
      return {
        minX: min,
        maxX: max - 1,
        minY: min + 1,
        maxY: max,
      }
    case LEFT:
      return {
        minX: min,
        maxX: max - 1,
        minY: min,
        maxY: max - 1,
      }
    }
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

  // ---- Attack ---- //
  public heal(targets?: AnyCreep[]): void {
    const damagedCreeps = this.creeps
      .filter(creep => (creep.hits <= creep.hitsMax))

    if (targets != null && targets.length > 0) {
      this.healDamagedCreeps(targets.concat(damagedCreeps))
    } else {
      this.healDamagedCreeps(damagedCreeps)
    }
  }

  private healDamagedCreeps(damagedCreeps: AnyCreep[]): void {
    const healers = this.creeps.filter(creep => creep.getActiveBodyparts(HEAL) > 0)

    damagedCreeps
      .sort((lhs, rhs) => {
        return (rhs.hitsMax - rhs.hits) - (lhs.hitsMax - lhs.hits)
      })
      .forEach(damagedCreep => {
        const healerCount = healers.length
        for (let i = 0; i < healerCount; i += 1) {
          let damage = damagedCreep.hitsMax - damagedCreep.hits
          if (damage <= 0) {
            return
          }
          const healer = healers.pop()
          if (healer == null) {
            return
          }
          const result = healer.heal(damagedCreep)
          switch (result) {
          case OK:
            damage -= CreepBody.power(healer.body, "heal")
            break
          case ERR_NO_BODYPART:
            break
          case ERR_NOT_IN_RANGE:
            if (healer.rangedHeal(damagedCreep) === OK) {
              damage -= (CreepBody.power(healer.body, "heal") / 3)
              break
            }
            healers.unshift(healer)
            break
          default:
            PrimitiveLogger.programError(`Quad.heal() returns ${result}, healer: ${healer.pos}, target: ${damagedCreep.pos} in ${roomLink(healer.room.name)}`)
            healers.unshift(healer)
            break
          }
        }
      })

    healers.forEach(healer => {
      healer.heal(healer)
    })
  }

  public attack(mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[]): void {
    this.creeps.forEach(creep => {
      if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
        this.rangedAttackCreep(creep, mainTarget, [...optionalTargets])
      }
      if (creep.getActiveBodyparts(ATTACK) > 0) {
        const nearbyTarget = mainTarget ?? creep.pos.findInRange(optionalTargets, 1)[0]
        if (nearbyTarget != null) {
          this.rotateTo(nearbyTarget)
          creep.attack(nearbyTarget)
        }
      } else if (creep.getActiveBodyparts(WORK) > 0) {
        const nearbyTarget = mainTarget ?? creep.pos.findInRange(optionalTargets, 1)[0]
        if (nearbyTarget != null && !isAnyCreep(nearbyTarget)) {
          this.rotateTo(nearbyTarget)
          creep.dismantle(nearbyTarget)
        }
      }
    })
  }

  public passiveAttack(targets: QuadAttackTargetType[]): void {
    this.creeps.forEach(creep => {
      if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
        this.rangedAttackCreep(creep, null, targets)
      }
      if (creep.getActiveBodyparts(ATTACK) > 0) {
        const target = creep.pos.findInRange(targets, 1)[0]
        if (target != null) {
          creep.attack(target)
        }
      }
    })
  }

  private rangedAttackCreep(creep: Creep, mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[]): void {
    if (mainTarget != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (creep.pos.getRangeTo(mainTarget) <= 1 && (mainTarget as any).owner != null) {
        creep.rangedMassAttack()
      } else {
        creep.rangedAttack(mainTarget)
      }
      return
    }

    if (optionalTargets.length <= 0) {
      return
    }

    let attackPower = 0
    const maxSingleAttackPower = 10
    const targets: [QuadAttackTargetType, number][] = optionalTargets.map(target => [target, target.pos.getRangeTo(creep.pos)])

    for (const [target, range] of targets) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((target as any).owner == null) {
        continue
      }
      switch (range) {
      case 0:
      case 1:
        attackPower += 10
        break
      case 2:
        attackPower += 4
        break
      case 3:
        attackPower += 1
        break
      default:
        break
      }
      if (attackPower >= maxSingleAttackPower) {
        break
      }
    }
    if (attackPower > maxSingleAttackPower) {
      creep.rangedMassAttack()
      return
    }
    const targetInfo = targets.sort(([, lhs], [, rhs]) => {
      return lhs - rhs
    })[0]
    if (targetInfo == null) {
      creep.rangedMassAttack()
      return
    }
    const [target,] = targetInfo
    creep.rangedAttack(target)
  }
}

function getFieldType(position: RoomPosition, excludedCreepNames: CreepName[]): "obstacle" | "swamp" | "plain" {
  const terrain = position.lookFor(LOOK_TERRAIN)[0]
  switch (terrain) {
  case "plain": {
    return hasObstacleObjectAt(position, excludedCreepNames) === true ? "obstacle" : "plain"
  }
  case "swamp": {
    return hasObstacleObjectAt(position, excludedCreepNames) ? "obstacle" : "swamp"
  }
  case "wall":
    return "obstacle"
  default:
    PrimitiveLogger.programError(`Unexpected terrain ${terrain} at ${position} in ${roomLink(position.roomName)}`)
    return "obstacle"
  }
}

const walkableStructures: StructureConstant[] = [
  STRUCTURE_CONTAINER,
  STRUCTURE_ROAD,
]

function hasObstacleObjectAt(position: RoomPosition, excludedCreepNames: CreepName[]): boolean {
  return position.look().some(obj => {
    switch (obj.type) {
    case "creep":
      if (obj.creep == null) {
        return false
      }
      if (excludedCreepNames.includes(obj.creep.name)) {
        return false
      }
      return true
    case "powerCreep":
      return true

    case "structure":
      if (obj.structure == null) {
        return false
      }
      return walkableStructures.includes(obj.structure.structureType) !== true

    default:
      return false
    }
  })
}

function quadCostCallback(excludedCreepNames: CreepName[], quadDirection: Direction, positionsToAvoid?: RoomPosition[]): (roomName: RoomName, costMatrix: CostMatrix) => CostMatrix {
  return (roomName: RoomName, costMatrix: CostMatrix): CostMatrix => {
    const room = Game.rooms[roomName]
    if (room == null) {
      return costMatrix
    }

    const obstacleCost = GameConstants.pathFinder.costs.obstacle
    if (positionsToAvoid != null) {
      positionsToAvoid.forEach(position => {
        costMatrix.set(position.x, position.y, obstacleCost)
      })
    }

    if (room.roomType === "source_keeper") {
      const roomPositionFilteringOptions: RoomPositionFilteringOptions = {
        excludeItself: false,
        excludeTerrainWalls: false,
        excludeStructures: false,
        excludeWalkableStructures: false,
      }
      const sourceKeepers = room.find(FIND_HOSTILE_CREEPS)
        .filter(creep => creep.owner.username === SourceKeeper.username)
      const sourceKeeperPositions = sourceKeepers
        .flatMap(creep => creep.pos.positionsInRange(5, roomPositionFilteringOptions))

      sourceKeeperPositions.forEach(position => {
        costMatrix.set(position.x, position.y, obstacleCost)
      })
    }

    const obstacleDirections = ((): DirectionConstant[] => {
      switch (quadDirection) {
      case TOP:
        return [
          TOP,
          TOP_RIGHT,
          RIGHT,
        ]
      case RIGHT:
        return [
          RIGHT,
          BOTTOM_RIGHT,
          BOTTOM,
        ]
      case BOTTOM:
        return [
          BOTTOM,
          BOTTOM_LEFT,
          LEFT,
        ]
      case LEFT:
        return [
          LEFT,
          TOP_LEFT,
          TOP,
        ]
      }
    })()

    const getObstaclePositions = (position: RoomPosition): RoomPosition[] => {
      return obstacleDirections.flatMap(direction => position.positionTo(direction) ?? [])
    }
    const swampCost = GameConstants.pathFinder.costs.swamp

    for (let y = 0; y <= GameConstants.room.edgePosition.max; y += 1) {
      for (let x = 0; x <= GameConstants.room.edgePosition.max; x += 1) {
        const position = new RoomPosition(x, y, roomName)
        const fieldType = getFieldType(position, excludedCreepNames)
        switch (fieldType) {
        case "plain":
          break

        case "swamp":
          getObstaclePositions(position).forEach(p => {
            costMatrix.set(x, y, swampCost)
            if (costMatrix.get(p.x, p.y) < swampCost) {
              costMatrix.set(p.x, p.y, swampCost)
            }
          })
          break

        case "obstacle":
          costMatrix.set(x, y, obstacleCost)
          getObstaclePositions(position).forEach(p => {
            costMatrix.set(p.x, p.y, obstacleCost)
          })
          break
        }
      }
    }

    return costMatrix
  }
}

function moveToRoomQuad(creep: Creep, targetRoomName: RoomName, waypoints: RoomName[], excludedCreepNames: CreepName[], quadDirection: Direction): RoomPosition {
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
      costCallback: quadCostCallback(excludedCreepNames, quadDirection),
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
    if (showPath === true) {
      nextSteps.forEach((step, index) => {  // FixMe: デバッグコード
        const p = new RoomPosition(step.x, step.y, creep.room.name)
        creep.room.visual.text(`${index}`, p, { color: "#ffffff" })
      })
    }
    return new RoomPosition(nextSteps[0].x, nextSteps[0].y, creep.room.name)
  } catch (e) {
    PrimitiveLogger.programError(`moveToRoomQuad() failed: ${e}`)
    creep.say("error")
    return creep.pos
  }
}

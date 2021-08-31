import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName, isAnyCreep } from "prototype/creep"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
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
const rotationDirectionMap: { [direction in Direction]: Direction } = {
  1: LEFT,
  7: BOTTOM,
  5: RIGHT,
  3: TOP,
}
function leftRotationDirectionOf(direction: Direction): Direction {
  return rotationDirectionMap[direction]
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
  wait: boolean
  backward: boolean
  healBeforeEnter: boolean
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

  direction: Direction
  nextDirection: Direction | null
  leaderRotationPositionState: RoomPositionState | null
  leaderName: CreepName
  followerNames: CreepName[]
  automaticRotationEnabled: boolean
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
  allCreepsInSameRoom(): boolean
  getMinRangeTo(position: RoomPosition): number
  getMaxRangeTo(position: RoomPosition): number
  isQuadForm(): boolean

  // ---- Member ---- //
  addCreep(creep: Creep): void
  includes(creepName: CreepName): boolean

  // ---- Action ---- //
  say(message: string): void

  // ---- Move ---- //
  moveToRoom(destinationRoomName: RoomName, waypoints: RoomName[], options?: { quadFormed?: boolean, wait?: boolean }): void
  moveTo(position: RoomPosition, range: number): void
  fleeFrom(position: RoomPosition, range: number): void
  keepQuadForm(): void

  // ---- Attack ---- //
  heal(targets?: AnyCreep[]): void
  attack(mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[]): void
  passiveAttack(targets: QuadAttackTargetType[]): void

  // ---- Execution ---- //
  beforeRun(): void
  run(): void

  setDirection(direction: Direction): void
}

export class Quad implements Stateful, QuadInterface {
  public setDirection(direction: Direction): void {
    this.direction = direction
  }

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
    private direction: Direction,
    private nextDirection: Direction | null,
    private leaderRotationPosition: RoomPosition | null,
    private leaderCreep: Creep,
    private readonly followerCreeps: Creep[],
    public automaticRotationEnabled: boolean,
  ) {
  }

  public encode(): QuadState {
    return {
      t: "Quad",
      direction: this.direction,
      nextDirection: this.nextDirection,
      leaderRotationPositionState: this.leaderRotationPosition?.encode() ?? null,
      leaderName: this.leaderCreep.name,
      followerNames: this.followerCreeps.map(creep => creep.name),
      automaticRotationEnabled: this.automaticRotationEnabled,
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
    const decodePosition = (roomPositionState: RoomPositionState | null): RoomPosition | null => {
      if (roomPositionState == null) {
        return null
      }
      return decodeRoomPosition(roomPositionState)
    }
    const leaderRotationPosition = decodePosition(state.leaderRotationPositionState)
    return new Quad(state.direction, state.nextDirection, leaderRotationPosition, leader, followerCreeps, state.automaticRotationEnabled ?? true)
  }

  public static create(leaderCreep: Creep, followerCreeps: Creep[]): Quad | null {
    return new Quad(TOP, null, null, leaderCreep, followerCreeps, true)
  }

  // ---- Position ---- //
  public inRoom(roomName: RoomName): boolean {
    return this.creeps.every(creep => (creep.room.name === roomName))
  }

  public allCreepsInSameRoom(): boolean {
    return this.inRoom(this.leaderCreep.room.name)
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
      if (position != null) {
        if (creep.pos.isEqualTo(position) === true) {
          return true
        } else {
          const nextRoomEdgePosition = position.nextRoomEdgePosition()
          if (nextRoomEdgePosition != null && creep.pos.isEqualTo(nextRoomEdgePosition) === true) {
            return true
          }
        }
      } else {
        const nextRoomEdgePosition = this.pos.nextRoomPositionTo(directionFromTopRight)
        if (nextRoomEdgePosition != null && creep.pos.isEqualTo(nextRoomEdgePosition) === true) {
          return true
        }
      }
      return false
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
  public say(message: string, toPublic?: boolean): void {
    this.creeps[0]?.say(message, toPublic)
  }

  // ---- Move ---- //
  public moveToRoom(destinationRoomName: RoomName, waypoints: RoomName[], options?: { quadFormed?: boolean, wait?: boolean, backward?: boolean, healBeforeEnter?: boolean}): void {
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
      taskType: "move to room",
      roomName: destinationRoomName,
      waypoints: waypoints,
      quadFormed: options?.quadFormed ?? false,
      wait: options?.wait ?? false,
      backward: options?.backward ?? false,
      healBeforeEnter: options?.healBeforeEnter ?? false,
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
      taskType: "flee",
      position,
      range,
    }
  }

  public keepQuadForm(): void {
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
      taskType: "form"
    }
  }

  // ---- Execution ---- //
  public beforeRun(): void {
    if (this.leaderRotationPosition != null && this.leaderCreep.pos.isEqualTo(this.leaderRotationPosition) === true) {
      this.leaderRotationPosition = null
    }

    if (this.nextDirection != null) {
      if (this.nextDirection === this.direction) {
        this.nextDirection = null
      } else {
        this.moveTask = {
          taskType: "rotate",
          direction: this.nextDirection,
        }
      }
    }
  }

  public run(): void {
    // this.followerCreeps[0]?.say(this.moveTask.taskType)
    switch (this.moveTask.taskType) {
    case "move to room":
      this.runMoveToRoom(
        this.moveTask.roomName,
        this.moveTask.waypoints,
        this.moveTask.quadFormed,
        this.moveTask.wait,
        this.moveTask.backward,
        this.moveTask.healBeforeEnter,
      )
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

  private runMoveToRoom(destinationRoomName: RoomName, waypoints: RoomName[], quadFormed: boolean, wait: boolean, backward: boolean, healBeforeEnter: boolean): void {
    if (quadFormed !== true) {
      const status = this.getMoveToRoomStatus(this.pos, this.room, destinationRoomName, waypoints)
      switch (status) {
      case "in progress":
        moveToRoom(this.leaderCreep, destinationRoomName, waypoints, 1)
        this.follow()
        return

      case "close to room exit": {
        if (wait !== true) {
          const quadRange = this.getMaxRangeTo(this.pos)  // FixMe: 部屋の境界付近で近づけない場合スタックする
          if (quadRange <= 5) {
            moveToRoom(this.leaderCreep, destinationRoomName, waypoints, 1)
          }
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
    const nextMove = moveToRoomQuad(this.leaderCreep, destinationRoomName, waypoints, this.creeps.map(creep => creep.name), this.direction)
    if (nextMove == null) {
      return
    }
    const {moveDirection, exitDirection} = nextMove
    if (backward === true) {
      const quadDirection = oppositeDirectionMap[exitDirection]
      if (this.direction !== quadDirection) {
        this.nextDirection = quadDirection
      }
    }

    if (healBeforeEnter === true && this.damage > 0) {
      return
    }
    this.leaderCreep.move(moveDirection)
    this.moveFollowersToNextDirection(moveDirection)
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
      if (this.automaticRotationEnabled === true && this.leaderCreep.pos.isNearTo(position) !== true) {
        this.runRotateTask(leftRotationDirectionOf(this.direction))
      }
      return
    }
    const pathFindingRange = ((): number => {
      if (this.leaderCreep.pos.getRangeTo(position) <= 2) {
        return 1
      }
      return Math.max(range, 2)
    })()

    const quadCreepNames = this.creeps.map(creep => creep.name)
    const pathFinderOptions: FindPathOpts = {
      costCallback: quadCostCallback(quadCreepNames, this.direction),
      range: pathFindingRange,
      ignoreCreeps: true,
      maxRooms: 1,
    }

    const nextSteps = this.room.findPath(this.pos, position, pathFinderOptions) // Room間移動は対応していない
    if (nextSteps[0] == null) {
      this.say(`np${position.x},${position.y}`)
      return
    }
    if (showPath === true) {
      nextSteps.forEach((step, index) => {
        const p = new RoomPosition(step.x, step.y, this.room.name)
        this.room.visual.text(`${index}`, p, { color: "#ffffff" })
      })
    }
    try {
      const nextPosition = new RoomPosition(nextSteps[0].x, nextSteps[0].y, this.room.name)
      const nextPositions: (RoomPosition | null)[] = [
        nextPosition,
        nextPosition.positionTo(this.absoluteQuadFollowerDirection(BOTTOM)),
        nextPosition.positionTo(this.absoluteQuadFollowerDirection(LEFT)),
        nextPosition.positionTo(this.absoluteQuadFollowerDirection(BOTTOM_LEFT)),
      ]
      const hasObstacle = nextPositions.some(quadNextPosition => {
        if (quadNextPosition == null) {
          return false
        }
        return hasObstacleObjectAt(quadNextPosition, quadCreepNames, true)
      })
      if (hasObstacle === true) {
        this.say("blocked")
        return
      }
    } catch (e) {
      PrimitiveLogger.programError(`Quad.runMoveTo() failed ${e} ${roomLink(this.room.name)}`)
    }
    const nextDirection = nextSteps[0].direction
    this.leaderCreep.move(nextDirection)
    this.moveFollowersToNextDirection(nextDirection)
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
    const nextDirection = nextSteps[0].direction
    this.leaderCreep.move(nextDirection)
    this.moveFollowersToNextDirection(nextDirection)
  }

  private runKeepQuadForm(): void {
    if (this.isQuadForm() !== true) {
      this.align()
      return
    }
  }

  private runRotateTask(direction: Direction): void {
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
    if (this.isQuadForm() === true) {
      this.leaderRotationPosition = leaderNextPosition
    }
    this.direction = toDirection
    if (this.canMoveQquad() === true) {
      this.align()
    }
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

  private align(): void {
    const leaderRotationPosition = ((): RoomPosition | null => {
      if (this.leaderRotationPosition != null && this.leaderCreep.pos.isEqualTo(this.leaderRotationPosition) === true) {
        this.leaderRotationPosition = null
        return null
      }
      return this.leaderRotationPosition
    })()

    if (leaderRotationPosition != null) {
      // if (this.isQuadForm() === true) {
      this.say("rotate")
      this.leaderCreep.moveTo(leaderRotationPosition, this.moveToOptions(1))  // FixMe: target room直前でrotateしようとしてclose to destinationから抜けてしまうのではないか
      this.moveFollowersToNexPosition(leaderRotationPosition)
      return
      // }
    }

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

    const nextDirection = ((): DirectionConstant | null => {
      if (this.leaderCreep.pos.isEqualTo(leaderAvoidEdgePosition) !== true) {
        if (hasObstacle(leaderAvoidEdgePosition) === true) {
          this.say("avoid-o1")
          return this.absoluteQuadDirection(RIGHT)
        }
        this.say("avoid-e")
        if (leaderAvoidEdgePosition.isEqualTo(this.leaderCreep.pos) === true) {
          return null
        }
        return this.leaderCreep.pos.getDirectionTo(leaderAvoidEdgePosition)
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
          this.say("avoid-o2")
          return oppositeDirections(absoluteDirection)[Game.time % 3] ?? oppositeDirection(absoluteDirection)
        }
      }

      this.leaderCreep.say("align")
      return null
    })()

    if (nextDirection != null) {
      this.leaderCreep.move(nextDirection)
      this.moveFollowersToNextDirection(nextDirection)
      return
    }
    this.moveFollowersToNexPosition(this.leaderCreep.pos)
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

  private moveFollowersToNextDirection(direction: DirectionConstant): void {
    const move = (creepIndex: number): void => {
      const creep = this.creeps[creepIndex]
      if (creep == null || creep.spawning === true) {
        return
      }
      creep.move(direction)
    }

    move(1)
    move(2)
    move(3)
  }

  private moveFollowersToNexPosition(nextPosition: RoomPosition): void {
    const move = (creepIndex: number, directionFromTopRight: DirectionConstant): void => {
      const creep = this.creeps[creepIndex]
      if (creep == null || creep.spawning === true) {
        return
      }
      const position = nextPosition.positionTo(directionFromTopRight) ?? nextPosition.nextRoomPositionTo(directionFromTopRight)
      const ignoreCreeps = creep.pos.getRangeTo(position) > 1 ? false : true
      creep.moveTo(position, this.moveToOptions(2, ignoreCreeps))
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
      if (previousCreep == null || previousCreep.spawning === true || creep == null) {
        return
      }
      creep.moveTo(previousCreep.pos, this.moveToOptions(2))
    }

    follow(1)
    follow(2)
    follow(3)
  }

  private moveToOptions(maxRooms: number, ignoreCreeps?: boolean): MoveToOpts {
    return {
      maxRooms,
      maxOps: 500,
      reusePath: 0,
      ignoreCreeps: ignoreCreeps ?? true,
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
        const nearbyTarget = ((): QuadAttackTargetType | null => {
          if (mainTarget != null && mainTarget.pos.isNearTo(creep.pos) === true) {
            return mainTarget
          }
          return creep.pos.findInRange(optionalTargets, 1)[0] ?? null
        })()
        if (nearbyTarget != null) {
          creep.attack(nearbyTarget)
        }
      } else if (creep.getActiveBodyparts(WORK) > 0) {
        const nearbyTarget = ((): AnyStructure | null => {
          if (mainTarget != null && !isAnyCreep(mainTarget) && mainTarget.pos.isNearTo(creep.pos) === true) {
            return mainTarget
          }
          const nearbyTargets = creep.pos.findInRange(optionalTargets, 1)
          for (const target of nearbyTargets) {
            if (!isAnyCreep(target)) {
              return target
            }
          }
          return null
        })()
        if (nearbyTarget != null) {
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
      } else if (creep.getActiveBodyparts(WORK) > 0) {
        const nearbyTargets = creep.pos.findInRange(targets, 1)
        for (const target of nearbyTargets) {
          if (isAnyCreep(target)) {
            continue
          }
          creep.dismantle(target)
          break
        }
      }
    })
  }

  private rangedAttackCreep(creep: Creep, mainTarget: QuadAttackTargetType | null, optionalTargets: QuadAttackTargetType[]): void {
    if (mainTarget != null) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (creep.pos.getRangeTo(mainTarget) <= 1 && (mainTarget as any).owner != null) {
        creep.rangedMassAttack()
        return
      } else {
        if (creep.rangedAttack(mainTarget) === OK) {
          return
        }
      }
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
    return hasObstacleObjectAt(position, excludedCreepNames) === true ? "obstacle" : "swamp"
  }
  case "wall":
    return "obstacle"
  default:
    PrimitiveLogger.programError(`Unexpected terrain ${terrain} at ${position} in ${roomLink(position.roomName)}`)
    return "obstacle"
  }
}

const walkableStructures: StructureConstant[] = [
  STRUCTURE_ROAD,
  STRUCTURE_CONTAINER,
]
const unbreakableStructureTypes: StructureConstant[] = [
  STRUCTURE_KEEPER_LAIR,
  STRUCTURE_CONTROLLER,
  STRUCTURE_POWER_BANK,
  STRUCTURE_PORTAL,
  STRUCTURE_INVADER_CORE,
]

function hasObstacleObjectAt(position: RoomPosition, excludedCreepNames: CreepName[], markDestructiveStructureAsObstacle?: boolean): boolean {
  const structureAsObstacle = markDestructiveStructureAsObstacle ?? false
  return position.look().some(obj => {
    switch (obj.type) {
    case "creep":
      if (obj.creep == null) {
        return false
      }
      if (excludedCreepNames.includes(obj.creep.name)) {
        return false
      }
      if (obj.creep.my === true) {
        return true
      }
      return false
    case "powerCreep":
      return true

    case "structure": {
      const structure = obj.structure
      if (structure == null) {
        return false
      }
      if (unbreakableStructureTypes.includes(structure.structureType) === true) {
        return true
      }
      if (walkableStructures.includes(structure.structureType) === true) {
        return false
      }
      if (structureAsObstacle === true) {
        return true
      }
      if (structure.hits <= 5000) {
        return false
      }
      return true
    }

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
    const roomMinEdge = GameConstants.room.edgePosition.min
    const roomMaxEdge = GameConstants.room.edgePosition.max
    const exitPositionCost = obstacleCost - 1

    for (let y = roomMinEdge; y <= roomMaxEdge; y += 1) {
      for (let x = roomMinEdge; x <= roomMaxEdge; x += 1) {
        const position = new RoomPosition(x, y, roomName)
        if (position.isRoomEdge === true) {
          if (costMatrix.get(x, y) < exitPositionCost) {
            costMatrix.set(x, y, exitPositionCost)
          }
          getObstaclePositions(position).forEach(p => {
            if (costMatrix.get(p.x, p.y) < exitPositionCost) {
              costMatrix.set(p.x, p.y, exitPositionCost)
            }
          })
          continue
        }

        const fieldType = getFieldType(position, excludedCreepNames)
        switch (fieldType) {
        case "plain":
          break

        case "swamp":
          if (costMatrix.get(x, y) < swampCost) {
            costMatrix.set(x, y, swampCost)
          }
          getObstaclePositions(position).forEach(p => {
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

    // for (let y = roomMinEdge; y <= roomMaxEdge; y += 1) {
    //   for (let x = roomMinEdge; x <= roomMaxEdge; x += 1) {
    //     const costDescription = ((): string => {
    //       const cost = costMatrix.get(x, y)
    //       if (cost === obstacleCost) {
    //         return "■"
    //       }
    //       return `${cost}`
    //     })()
    //     room.visual.text(costDescription, x, y)
    //   }
    // }

    return costMatrix
  }
}

function moveToRoomQuad(creep: Creep, targetRoomName: RoomName, waypoints: RoomName[], excludedCreepNames: CreepName[], quadDirection: Direction): {moveDirection: DirectionConstant, exitDirection: Direction} | null {
  try {
    const creepRoom = creep.room
    if (creepRoom.name === targetRoomName) {
      return null
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
      return null
    } else if (exit === ERR_INVALID_ARGS) {
      creep.say("invalid")
      PrimitiveLogger.fatal(`Room.findExitTo() returns ERR_INVALID_ARGS (${exit}), room ${roomLink(creepRoom.name)} to ${roomLink(destinationRoomName)}`)
      return null
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
      creep.say(`no path1-${exit}`)
      return null
    }

    const nextSteps = creep.room.findPath(creep.pos, exitPosition, pathFinderOptions) // Room間移動は対応していない
    if (nextSteps[0] == null) {
      creep.say("no path2")
      return null
    }
    if (showPath === true) {
      nextSteps.forEach((step, index) => {  // FixMe: デバッグコード
        const p = new RoomPosition(step.x, step.y, creep.room.name)
        creep.room.visual.text(`${index}`, p, { color: "#ffffff" })
      })
    }
    return {
      moveDirection: nextSteps[0].direction,
      exitDirection: exit,
    }
  } catch (e) {
    PrimitiveLogger.programError(`moveToRoomQuad() failed: ${e}`)
    creep.say("error")
    return null
  }
}

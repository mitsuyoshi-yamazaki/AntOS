import { SourceKeeper } from "game/source_keeper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepName } from "prototype/creep"
import { RoomPositionFilteringOptions } from "prototype/room_position"
import { moveToRoom } from "script/move_to_room"
import { GameConstants, oppositeDirection } from "utility/constants"
import { CreepBody } from "utility/creep_body"
import { roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { oppositeDirections } from "utility/direction"

export interface QuadState {
  creepNames: CreepName[]
}

type MoveToRoomStatus = "in progress" | "close to room exit" | "close to destination"
let exitingDirection = null as TOP | BOTTOM | LEFT | RIGHT | null

/**
 * - [ ] align時に余裕がないことを検出する
 * - [ ] 経路探索、特にRIGHTが障害物にならない問題がある
 */
class Quad {
  public get numberOfCreeps(): number {
    return this.creeps.length
  }
  public get topRightPosition(): RoomPosition | null {
    return this.creeps[0]?.pos ?? null
  }
  public get topRightRoom(): Room | null {
    return this.creeps[0]?.room ?? null
  }

  public creeps: Creep[] = []

  public constructor(
    creepNames: CreepName[],
  ) {
    creepNames.forEach(creepName => {
      const creep = Game.creeps[creepName]
      if (creep != null) {
        this.creeps.push(creep)
      }
    })
  }

  public say(message: string): void {
    this.creeps[0]?.say(message)
  }

  public inRoom(roomName: RoomName): boolean {
    return this.creeps.every(creep => (creep.room.name === roomName))
  }

  public fleeFrom(position: RoomPosition): void {
    // TODO:
  }

  public getMinRangeTo(position: RoomPosition): number | null {
    if (this.creeps.length <= 0) {
      return null
    }
    const closest = this.creeps.reduce((lhs, rhs) => {
      return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
    })
    const minRange = closest.pos.getRangeTo(position)
    if (isFinite(minRange) !== true) {
      return null
    }
    return minRange
  }

  public getMaxRangeTo(position: RoomPosition): number | null {
    if (this.creeps.length <= 0) {
      return null
    }
    const farthest = this.creeps.reduce((lhs, rhs) => {
      return lhs.pos.getRangeTo(position) > rhs.pos.getRangeTo(position) ? lhs : rhs
    })
    const maxRange = farthest.pos.getRangeTo(position)
    if (isFinite(maxRange) !== true) {
      return null
    }
    return maxRange
  }

  public moveQuadToRoom(destinationRoomName: RoomName, waypoints: RoomName[]): void {
    const topRight = this.creeps[0]
    if (topRight == null) {
      return
    }

    const status = this.getMoveToRoomStatus(topRight.pos, topRight.room, destinationRoomName, waypoints)
    switch (status) {
    case "in progress":
      moveToRoom(topRight, destinationRoomName, waypoints)
      this.follow()
      return

    case "close to room exit": {
      const quadRange = this.getMaxRangeTo(topRight.pos)
      if (quadRange != null && quadRange <= 5) {
        moveToRoom(topRight, destinationRoomName, waypoints)
      }
      this.follow()
      return
    }

    case "close to destination":
      break
    }

    if (this.isQuadForm() !== true) {
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

  /**
   * @param range 全てのCreepがこのrangeに入る
   */
  public moveQuadTo(position: RoomPosition, range: number): void {
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
    const maxRange = this.getMaxRangeTo(position)
    if (maxRange != null && maxRange <= range) {
      topRight.say("ok")
      return
    }

    const pathFinderOptions: FindPathOpts = {
      costCallback: quadCostCallback,
      range: 0,
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
      topRight.room.visual.text(`${index}`, p, { color: "#ffffff" })
    })
    const nextPosition = new RoomPosition(nextSteps[0].x, nextSteps[0].y, topRight.room.name)
    topRight.moveTo(nextPosition)
    this.moveFollowersToNextPosition(nextPosition, 1)
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

    const threshold = 6
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

  public align(): void {
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
    if (topRight.pos.isEqualTo(topRightPosition) === true) {
      const followerDirections: DirectionConstant[] = [
        LEFT,
        BOTTOM_LEFT,
        BOTTOM,
      ]
      for (const positionDirection of followerDirections) {
        const followerPosition = topRight.pos.positionTo(positionDirection)
        if (followerPosition == null) {
          continue
        }
        const hasObstacle = ((): boolean => {
          switch (getFieldType(followerPosition)) {
          case "plain":
          case "swamp":
            return false
          case "obstacle":
            return true
          }
        })()
        if (hasObstacle === true) {
          const direction = oppositeDirections(positionDirection)[Game.time % 3] ?? oppositeDirection(positionDirection)
          topRight.move(direction)
          break
        }
      }
    } else {
      topRight.moveTo(topRightPosition)
    }

    this.moveFollowersToNextPosition(topRightPosition, 2)
  }

  protected canMove(): boolean {
    if (this.creeps.length <= 0) {
      return false
    }
    return this.creeps.every(creep => (creep.fatigue <= 0))
  }

  protected canMoveQquad(): boolean {
    if (this.canMove() !== true) {
      return false
    }
    return this.isQuadForm()
  }

  public isQuadForm(): boolean {
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

const walkableStructures: StructureConstant[] = [
  STRUCTURE_CONTAINER,
  STRUCTURE_ROAD,
]

function getFieldType(position: RoomPosition): "obstacle" | "swamp" | "plain" {
  const terrain = position.lookFor(LOOK_TERRAIN)[0]
  switch (terrain) {
  case "plain": {
    const isObstacle = position.lookFor(LOOK_STRUCTURES).some(structure => (walkableStructures.includes(structure.structureType) !== true))
    return isObstacle === true ? "obstacle" : "plain"
  }
  case "swamp": {
    const isObstacle = position.lookFor(LOOK_STRUCTURES).some(structure => (walkableStructures.includes(structure.structureType) !== true))
    return isObstacle === true ? "obstacle" : "swamp"
  }
  case "wall":
    return "obstacle"
  default:
    PrimitiveLogger.programError(`Unexpected terrain ${terrain} at ${position} in ${roomLink(position.roomName)}`)
    return "obstacle"
  }
}

function quadCostCallback(roomName: RoomName, costMatrix: CostMatrix): CostMatrix {
  const room = Game.rooms[roomName]
  if (room == null) {
    return costMatrix
  }

  const obstacleCost = GameConstants.pathFinder.costs.obstacle
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
      costMatrix.set(position.x, position.y, obstacleCost)
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

  for (let y = 0; y <= GameConstants.room.edgePosition.max; y += 1) {
    for (let x = 0; x <= GameConstants.room.edgePosition.max; x += 1) {
      const position = new RoomPosition(x, y, roomName)
      const fieldType = getFieldType(position)
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

export class HRAQuad extends Quad {
  public attack(target: AnyCreep | AnyStructure): void {
    this.creeps.forEach(creep => {
      if (creep.pos.isNearTo(target) === true) {
        creep.rangedMassAttack()
      } else {
        creep.rangedAttack(target)
      }
    })
  }

  public heal(): void {
    if (this.isQuadForm() !== true) {
      this.creeps.forEach(creep => creep.heal(creep))
      return
    }

    const damagedCreeps = [...this.creeps].sort((lhs, rhs) => {
      return (rhs.hitsMax - rhs.hits) - (lhs.hitsMax - lhs.hits)
    })
    const healers = [...this.creeps]

    damagedCreeps.forEach(damagedCreep => {
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
        default:
          PrimitiveLogger.programError(`HRAQuad.heal() returns ${result}, healer: ${healer.pos}, target: ${damagedCreep.pos} in ${roomLink(healer.room.name)}`)
          healers.unshift(healer)
          break
        }
      }
    })

    healers.forEach(healer => {
      healer.heal(healer)
    })
  }
}

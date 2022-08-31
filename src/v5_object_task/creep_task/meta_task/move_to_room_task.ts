import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions } from "prototype/creep"
import { roomTypeOf } from "shared/utility/room_name"
import { decodeRoomPosition, RoomPositionFilteringOptions, RoomPositionState } from "prototype/room_position"
import { TaskProgressType } from "v5_object_task/object_task"
import { roomLink } from "utility/log"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { SourceKeeper } from "game/source_keeper"
import { GameConstants } from "utility/constants"
import type { RoomName } from "shared/utility/room_name_types"

export interface MoveToRoomTaskState extends CreepTaskState {
  /** destination room name */
  d: RoomName

  /** waypoints */
  w: RoomName[]

  /** exit position */
  e: RoomPositionState | null

  ignoreSwamp: boolean
  paused: boolean
}

export class MoveToRoomTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly destinationRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private exitPosition: RoomPosition | null,
    private readonly ignoreSwamp: boolean,
    private paused: boolean,
  ) {
    this.shortDescription = this.destinationRoomName
  }

  public encode(): MoveToRoomTaskState {
    return {
      s: this.startTime,
      t: "MoveToRoomTask",
      d: this.destinationRoomName,
      w: this.waypoints,
      e: this.exitPosition?.encode() ?? null,
      ignoreSwamp: this.ignoreSwamp,
      paused: this.paused,
    }
  }

  public static decode(state: MoveToRoomTaskState): MoveToRoomTask {
    const exitPosition = state.e != null ? decodeRoomPosition(state.e) : null
    return new MoveToRoomTask(state.s, state.d, state.w, exitPosition, state.ignoreSwamp ?? false, state.paused ?? false)
  }

  public static create(destinationRoomName: RoomName, waypoints: RoomName[], ignoreSwamp?: boolean): MoveToRoomTask {
    return new MoveToRoomTask(Game.time, destinationRoomName, [...waypoints], null, ignoreSwamp ?? false, false)
  }

  public pause(paused: boolean): void {
    this.paused = paused
  }

  public run(creep: Creep): TaskProgressType {
    if (this.paused === true) {
      return TaskProgressType.InProgress
    }

    if (creep.pos.x === 0) {
      if (creep.move(RIGHT) === OK) {
        return TaskProgressType.InProgress
      }
    } else if (creep.pos.x === 49) {
      if (creep.move(LEFT) === OK) {
        return TaskProgressType.InProgress
      }
    } else if (creep.pos.y === 0) {
      if (creep.move(BOTTOM) === OK) {
        return TaskProgressType.InProgress
      }
    } else if (creep.pos.y === 49) {
      if (creep.move(TOP) === OK) {
        return TaskProgressType.InProgress
      }
    }

    if (creep.room.name === this.destinationRoomName) {
      return TaskProgressType.Finished
    }

    const destinationRoomName = ((): RoomName => {
      const nextWaypoint = this.waypoints[0]
      if (nextWaypoint == null) {
        return this.destinationRoomName
      }
      if (nextWaypoint === creep.room.name) {
        this.waypoints.shift()
        return this.waypoints[0] ?? this.destinationRoomName
      }
      return nextWaypoint
    })()

    const reusePath = ((): number => {
      const defaultValue = 20
      const controller = creep.room.controller
      if (controller == null) {
        return defaultValue
      }
      if (controller.owner != null) {
        return 3
      }
      if (controller.reservation != null) {
        return 5
      }
      return defaultValue
    })()
    const noPathFindingOptions: MoveToOpts = {
      noPathFinding: true,
      reusePath,
    }
    if (this.ignoreSwamp) {
      noPathFindingOptions.swampCost = 1
    }

    const portals = creep.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL } }) as StructurePortal[]

    const moveToOptions = ((): MoveToOpts => {
      const options: MoveToOpts = defaultMoveToOptions()
      if (this.ignoreSwamp) {
        options.swampCost = 1
      }
      options.reusePath = reusePath

      const obstacleCost = GameConstants.pathFinder.costs.obstacle
      const edgeCost = obstacleCost - 1
      const positionsToAvoid: { position: RoomPosition, cost: number }[] = []

      switch (roomTypeOf(creep.room.name)) {
      case "normal":
      case "highway":
        return options

      case "source_keeper": {
        creep.say("SK room")
        // 保存されたパスがあれば計算はスキップする

        const roomPositionFilteringOptions: RoomPositionFilteringOptions = {
          excludeItself: false,
          excludeTerrainWalls: false,
          excludeStructures: false,
          excludeWalkableStructures: false,
        }

        options.maxOps = 2000
        const sourceKeeperDistance = 4
        const sourceKeeperPositions: {position: RoomPosition, cost: number}[] = creep.room.find(FIND_HOSTILE_CREEPS)
          .filter(hostileCreep => hostileCreep.owner.username === SourceKeeper.username)
          .flatMap(sourceKeeper => {
            return sourceKeeper.pos.positionsInRange(sourceKeeperDistance, roomPositionFilteringOptions)
              .map(position => {
                const cost = position.getRangeTo(sourceKeeper) < sourceKeeperDistance ? obstacleCost : edgeCost
                return {
                  position,
                  cost,
                }
              }
              )
          })
        positionsToAvoid.push(...sourceKeeperPositions)
        break
      }

      case "highway_crossing":
      case "sector_center":
        positionsToAvoid.push(...portals.map(portal => ({position: portal.pos, cost: obstacleCost})))
        break
      }

      if (positionsToAvoid.length <= 0) {
        return options
      }
      options.costCallback = (roomName: RoomName, costMatrix: CostMatrix): CostMatrix | void => {
        if (roomName !== creep.room.name) {
          return
        }
        positionsToAvoid.forEach(position => {
          // creep.room.visual.text("x", position.x, position.y, { align: "center", color: "#ff0000" })
          costMatrix.set(position.position.x, position.position.y, position.cost)
        })
        return costMatrix
      }
      return options
    })

    if (this.exitPosition != null) {
      if (this.exitPosition.roomName === creep.room.name) {
        if (creep.moveTo(this.exitPosition, noPathFindingOptions) === ERR_NOT_FOUND) {
          creep.moveTo(this.exitPosition, moveToOptions())
        }
        return TaskProgressType.InProgress
      }
      this.exitPosition = null
    }

    const exitPortal = portals.find(portal => {
      if (!(portal.destination instanceof RoomPosition)) {
        return false
      }
      if (portal.destination.roomName !== destinationRoomName) {
        return false
      }
      return true
    })

    const exitPosition = ((): RoomPosition | string => {
      if (exitPortal != null) {
        return exitPortal.pos
      }
      const exit = creep.room.findExitTo(destinationRoomName)
      if (exit === ERR_NO_PATH) {
        return "no exit"
      } else if (exit === ERR_INVALID_ARGS) {
        PrimitiveLogger.fatal(`Room.findExitTo() returns ERR_INVALID_ARGS (${exit}), room ${roomLink(creep.room.name)} to ${roomLink(destinationRoomName)}`)
        return "invalid"
      }

      const exitFlag = creep.room.find(FIND_FLAGS).find(flag => {
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

      if (exitFlag != null) {
        return exitFlag.pos
      }
      return creep.pos.findClosestByPath(exit) ?? "no path"
    })()

    if (typeof exitPosition === "string") {
      creep.say(exitPosition)
      // if (creep.room.controller != null) {
      //   creep.moveTo(creep.room.controller, defaultMoveToOptions())
      // } else {
      //   creep.moveTo(25, 25, defaultMoveToOptions())
      // }
      return TaskProgressType.InProgress  // TODO: よくはまるようなら代替コードを書く
    }

    this.exitPosition = exitPosition
    if (creep.moveTo(exitPosition, noPathFindingOptions) === ERR_NOT_FOUND) {
      creep.moveTo(exitPosition, moveToOptions())
    }

    return TaskProgressType.InProgress
  }
}

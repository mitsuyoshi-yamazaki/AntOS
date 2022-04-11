import { defaultMoveToOptions, ERR_DAMAGED, ERR_PROGRAMMING_ERROR, FINISHED, FINISHED_AND_RAN, IN_PROGRESS } from "prototype/creep"
import { TargetingApiWrapper, TargetingApiWrapperTargetType } from "v5_object_task/targeting_api_wrapper"
import { TaskProgressType } from "v5_object_task/object_task"
import { AnyCreepApiWrapper, CreepApiWrapperState, decodeCreepApiWrapperFromState } from "../creep_api_wrapper"
import { CreepTask } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"
import { decodeRoomPosition, RoomPositionId, RoomPositionState } from "prototype/room_position"
import { Timestamp } from "utility/timestamp"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText, roomLink } from "utility/log"
import { DirectionConstants } from "utility/direction"
import { GameConstants } from "utility/constants"

const noPathPositions: string[] = []
const getRouteIdentifier = (fromPosition: RoomPosition, toPosition: RoomPosition): string => {
  return `${fromPosition.id}_${toPosition.id}`
}

const Logger = {
  lastLog: 0,
  logCount: 0,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  log(message: string): void {
    this.logCount += 1

    const interval = 500
    if ((Game.time - this.lastLog) >= interval) {
      if (this.logCount > 0) {
        PrimitiveLogger.log(`${coloredText("[Error]", "error")} ${this.logCount} path errors in this ${interval} ticks`)
      }

      this.logCount = 0
      this.lastLog = Game.time
    }
  },
}

export type MoveToTargetTaskApiWrapper = AnyCreepApiWrapper & TargetingApiWrapper
type Position = {
  position: RoomPosition,
  timestamp: Timestamp
}
type PositionState = {
  position: RoomPositionState,
  timestamp: Timestamp,
}

type MoveToTargetTaskFixedOptions = {
  ignoreSwamp: boolean
  reusePath: number | null
  fallbackEnabled: boolean
  ignoreCreepsInRemote: boolean
}

export type MoveToTargetTaskOptions = Partial<MoveToTargetTaskFixedOptions>

export interface MoveToTargetTaskState extends CreepTaskState {
  /** api warpper state */
  as: CreepApiWrapperState

  /** ignore swamp */
  is: boolean

  lastPosition: PositionState | null
  reusePath: number | null
  fallbackEnabled: boolean
  ignoreCreepsInRemote: boolean
}

export class MoveToTargetTask implements CreepTask {
  public readonly shortDescription: string
  public get targetId(): Id<TargetingApiWrapperTargetType> {
    return this.apiWrapper.target.id
  }

  private constructor(
    public readonly startTime: number,
    public readonly apiWrapper: MoveToTargetTaskApiWrapper,
    private readonly options: MoveToTargetTaskFixedOptions,
    private lastPosition: Position | null,
  ) {
    this.shortDescription = apiWrapper.shortDescription
  }

  public encode(): MoveToTargetTaskState {
    return {
      s: this.startTime,
      t: "MoveToTargetTask",
      as: this.apiWrapper.encode(),
      is: this.options.ignoreSwamp ?? false,
      reusePath: this.options.reusePath ?? null,
      lastPosition: ((): PositionState | null => {
        if (this.lastPosition == null) {
          return null
        }
        return {
          position: this.lastPosition.position.encode(),
          timestamp: this.lastPosition.timestamp,
        }
      })(),
      fallbackEnabled: this.options.fallbackEnabled,
      ignoreCreepsInRemote: this.options.ignoreCreepsInRemote,
    }
  }

  public static decode(state: MoveToTargetTaskState): MoveToTargetTask | null {
    const wrapper = decodeCreepApiWrapperFromState(state.as)
    if (wrapper == null) {
      return null
    }
    const options: MoveToTargetTaskFixedOptions = {
      ignoreSwamp: state.is,
      reusePath: state.reusePath,
      fallbackEnabled: state.fallbackEnabled ?? false,
      ignoreCreepsInRemote: state.ignoreCreepsInRemote ?? false,
    }
    const lastPosition = ((): Position | null => {
      if (state.lastPosition == null) {
        return null
      }
      return {
        position: decodeRoomPosition(state.lastPosition.position),
        timestamp: state.lastPosition.timestamp,
      }
    })()
    return new MoveToTargetTask(state.s, wrapper as MoveToTargetTaskApiWrapper, options, lastPosition)
  }

  public static create(apiWrapper: MoveToTargetTaskApiWrapper, options?: MoveToTargetTaskOptions): MoveToTargetTask {
    const opt = ((): MoveToTargetTaskFixedOptions => {
      return {
        ignoreSwamp: options?.ignoreSwamp ?? false,
        reusePath: options?.reusePath ?? null,
        fallbackEnabled: options?.fallbackEnabled ?? false,
        ignoreCreepsInRemote: options?.ignoreCreepsInRemote ?? false,
      }
    })()
    return new MoveToTargetTask(Game.time, apiWrapper, opt, null)
  }

  public run(creep: Creep): TaskProgressType {
    const result = this.apiWrapper.run(creep)

    switch (result) {
    case FINISHED:
      return TaskProgressType.Finished

    case FINISHED_AND_RAN:
      return TaskProgressType.FinishedAndRan

    case IN_PROGRESS:
    case ERR_NOT_IN_RANGE: {
      const moveToOps = this.moveToOpts(creep, this.apiWrapper.range, this.apiWrapper.target.pos)
      const moveToResult = creep.moveTo(this.apiWrapper.target, moveToOps)
      if (moveToResult === ERR_NO_PATH && this.options.fallbackEnabled === true) {
        const routeIdentifier = getRouteIdentifier(creep.pos, this.apiWrapper.target.pos)
        // if (noPathPositions.includes(routeIdentifier) !== true) {
        if (creep.room.controller == null || creep.room.controller.my !== true) {
          const range = 5
          const isEdge = (): boolean => {
            const { min, max } = GameConstants.room.edgePosition
            if (creep.pos.x === min || creep.pos.x === max || creep.pos.y === min || creep.pos.y === max) {
              return true
            }
            return false
          }
          if (creep.pos.getRangeTo(this.apiWrapper.target.pos) > range || isEdge() === true) {
            moveToOps.maxOps = 3000
            moveToOps.maxRooms = 5
            moveToOps.ignoreCreeps = true
            moveToOps.range = range
            moveToOps.reusePath = 0
            const retryResult = creep.moveTo(this.apiWrapper.target, moveToOps)
            if (retryResult !== ERR_NO_PATH) {
              return TaskProgressType.InProgress
            }

            noPathPositions.push(routeIdentifier)
            const error = `creep.moveTo() ${creep.name} ${creep.pos} in ${roomLink(creep.room.name)} to ${this.apiWrapper.target.pos} returns no path error with ops: ${Array.from(Object.entries(moveToOps)).flatMap(x => x)}`
            Logger.log(error)
          }
        }
        // }

        // const emptyPositionDirection = getEmptyPositionDirection(creep.pos)
        // if (emptyPositionDirection != null) {
        //   creep.move(emptyPositionDirection)
        //   return TaskProgressType.InProgress
        // }
      }
      return TaskProgressType.InProgress
    }

    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_DAMAGED:
      return TaskProgressType.Finished

    case ERR_BUSY:
      return TaskProgressType.InProgress

    case ERR_PROGRAMMING_ERROR:
      return TaskProgressType.Finished
    }
  }

  private moveToOpts(creep: Creep, range: number, targetPosition: RoomPosition): MoveToOpts {
    if (this.lastPosition != null) {
      if (this.lastPosition.position.isEqualTo(creep.pos) === true) {
        if ((Game.time - this.lastPosition.timestamp) > 2) {
          const maxRooms = creep.pos.roomName === targetPosition.roomName ? 1 : 3
          const maxOps = creep.pos.roomName === targetPosition.roomName ? 1500 : 2000
          return {
            maxRooms,
            reusePath: this.options.reusePath ?? 3,
            maxOps,
            range,
          }
        } else {
          if (creep.fatigue > 0) {
            this.lastPosition.timestamp += 1
          }
        }
      } else {
        this.lastPosition = {
          position: creep.pos,
          timestamp: Game.time
        }
      }
    } else {
      this.lastPosition = {
        position: creep.pos,
        timestamp: Game.time
      }
    }

    const inEconomicArea = ((): boolean => {
      if (creep.room.controller == null) {
        return false
      }
      if (creep.room.controller.my === true) {
        return true
      }
      if (creep.room.controller.reservation == null) {
        return false
      }
      if (creep.room.controller.reservation.username === Game.user.name) {
        return true
      }
      return false
    })()

    const ignoreCreeps = ((): boolean => {
      if (this.options.ignoreCreepsInRemote === true) {
        return true
      }
      if (inEconomicArea !== true) {
        return false
      }
      // if (this.options.reusePath != null) {
      //   return false
      // }
      return true
    })()

    const reusePath = ((): number => {
      if (this.options.reusePath != null) {
        return this.options.reusePath
      }
      return inEconomicArea === true ? 100 : 0
    })()

    const options = defaultMoveToOptions()
    options.range = range
    options.maxRooms = creep.pos.roomName === targetPosition.roomName ? 1 : 3
    options.maxOps = creep.pos.roomName === targetPosition.roomName ? 500 : 1500
    options.reusePath = reusePath,
    options.ignoreCreeps = ignoreCreeps
    if (this.options.ignoreSwamp === true) {
      options.ignoreRoads = true
      options.swampCost = 1
    }
    return options
  }
}

const walkableStructureTypes: StructureConstant[] = [
  STRUCTURE_ROAD,
  STRUCTURE_CONTAINER,
  STRUCTURE_RAMPART,
]
class EmptyPositionCache {
  private filledPositionDirections = new Map<RoomPositionId, DirectionConstant[]>()
  private emptyPositionDirections = new Map<RoomPositionId, DirectionConstant[]>()

  public beforeTick(): void {
    this.emptyPositionDirections.clear()

    if ((Game.time % 10009) === 17) {
      this.refreshFilledDirections()
    }
  }

  public afterTick(): void {
  }

  public getEmptyPositionDirection(position: RoomPosition): DirectionConstant | null {
    const storedDirections = this.storedEmptyPositionDirections(position)
    const emptyPositionDirection = storedDirections.pop()
    return emptyPositionDirection ?? null
  }

  /**
   * @returns 参照を返すのでオブジェクトに変更を入れる場合はそのまま変更する
   */
  private storedEmptyPositionDirections(position: RoomPosition): DirectionConstant[] {
    const identifier = position.id
    const stored = this.emptyPositionDirections.get(identifier)
    if (stored != null) {
      return stored
    }

    const emptyPositionDirections = this.emptyPositionDirectionsFor(position, identifier)
    this.emptyPositionDirections.set(identifier, emptyPositionDirections)
    return emptyPositionDirections
  }

  private emptyPositionDirectionsFor(position: RoomPosition, identifier: RoomPositionId): DirectionConstant[] {
    const filledDirections = this.filledDirectionsFor(position, identifier)
    const directions = DirectionConstants.filter(direction => {
      if (filledDirections.includes(direction) === true) {
        return false
      }
      const targetPosition = position.positionTo(direction)
      if (targetPosition == null) {
        return false
      }
      const creeps = targetPosition.lookFor(LOOK_CREEPS)
      if (creeps.length > 0) {
        return false
      }
      return true
    })

    return directions
  }

  private filledDirectionsFor(position: RoomPosition, identifier: RoomPositionId): DirectionConstant[] {
    const stored = this.filledPositionDirections.get(identifier)
    if (stored != null) {
      return [...stored]
    }

    const filledDirections = DirectionConstants.filter(direction => {
      const targetPosition = position.positionTo(direction)
      if (targetPosition == null) {
        return true
      }
      const terrains = targetPosition.lookFor(LOOK_TERRAIN)
      if (terrains.some(terrain => terrain === "wall") === true) {
        return true
      }
      const structures = targetPosition.lookFor(LOOK_STRUCTURES)
      if (structures.some(structure => walkableStructureTypes.includes(structure.structureType) !== true) === true) {
        return true
      }
      return false
    })

    this.filledPositionDirections.set(identifier, filledDirections)
    // console.log(`${position} in ${roomLink(position.roomName)} filled ${filledDirections.map(direction => directionDescription(direction)).join(",")}`)

    return filledDirections
  }

  private refreshFilledDirections(): void {
    // TODO: 現状ではdeployによるheapのリセットに期待している
  }
}

export const emptyPositionCache = new EmptyPositionCache()

function getEmptyPositionDirection(position: RoomPosition): DirectionConstant | null {
  return emptyPositionCache.getEmptyPositionDirection(position)
}

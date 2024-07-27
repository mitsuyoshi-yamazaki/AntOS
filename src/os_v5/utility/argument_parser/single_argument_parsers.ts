import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Position } from "shared/utility/position_v2"
import { isMyRoom, MyRoom } from "shared/utility/room"
import { RoomName } from "shared/utility/room_name_types"
import { AvailableRoomPositions } from "shared/utility/room_position"
import { Range } from "shared/utility/types"
import { GameConstants } from "utility/constants"
import { CreepBody } from "utility/creep_body_v2"
import { ArgumentKey, ArgumentParserOptions, getKeyDescription, SingleOptionalArgument } from "./single_argument_parser"


// ---- Primitive Type ---- //
export class IntArgument extends SingleOptionalArgument<{ min?: number, max?: number }, number> {
  /** throws */
  public parse(options?: { min?: number, max?: number }): number {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const intValue = parseIntValue(this.key, this.value, options)
    return intValue
  }
}

export class FloatArgument extends SingleOptionalArgument<{ min?: number, max?: number }, number> {
  /** throws */
  public parse(options?: { min?: number, max?: number }): number {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const floatValue = parseFloat(this.value)
    if (isNaN(floatValue) === true) {
      throw `${this.value} is not an floating number`
    }
    validateNumberRange(this.key, floatValue, options)

    return floatValue
  }
}

export class BoolArgument extends SingleOptionalArgument<void, boolean> {
  /** throws */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(options?: void): boolean {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    switch (this.value) {
    case "0":
      return false
    case "1":
      return true
    default:
      throw `${this.value} is not boolean (0 or 1)`
    }
  }
}

export class StringArgument extends SingleOptionalArgument<void, string> {
  /** throws */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(options?: void): string {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    return this.value
  }
}

export class LocalPositionArgument extends SingleOptionalArgument<{ minX: number, maxX: number, minY: number, maxY: number }, Position> {
  /** throws */
  public parse(options?: { minX: number, maxX: number, minY: number, maxY: number }): Position {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const [x, y] = ((): [AvailableRoomPositions, AvailableRoomPositions] => {
      const components = this.value.split(",")
      if (components[0] == null || components[1] == null || components.length !== 2) {
        throw `Invalid format ${this.value}. expected: "{x},{y}"`
      }

      const { min, max } = GameConstants.room.edgePosition

      return [
        parseIntValue("x", components[0], { min: Math.max(min, options?.minX ?? min), max: Math.min(max, options?.maxX ?? max) }) as AvailableRoomPositions,
        parseIntValue("y", components[1], { min: Math.max(min, options?.minY ?? min), max: Math.min(max, options?.maxY ?? max) }) as AvailableRoomPositions,
      ]
    })()
    return {
      x,
      y,
    }
  }
}

/// {start}..{end}
export class RangeArgument extends SingleOptionalArgument<{ min?: number, max?: number }, Range> {
  /** throws */
  public parse(options?: { min?: number, max?: number }): Range {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const components = this.value.split("..")
    if (components.length !== 2 || components[0] == null || components[1] == null) {
      throw `Invalid format ${this.value}. expected: "{start}..{end}"`
    }

    const start = parseIntValue(this.key, components[0], options)
    const end = parseIntValue(this.key, components[1], options)
    if (start === end) {
      throw `Invalid range: zero length (${this.value})`
    }
    if (start > end) {
      throw `Invalid range: start (${start}) is bigger than end (${end})`
    }

    return {
      start,
      end,
    }
  }
}


// ---- Typed String ---- //
export class TypedStringArgument<T extends string> extends SingleOptionalArgument<void, T> {
  public constructor(
    key: ArgumentKey,
    value: string | null,
    private readonly typeName: string,
    private readonly typeGuard: ((arg: string) => arg is T),
    private readonly choises: Readonly<T[]> | null,
    parseOptions?: ArgumentParserOptions,
  ) {
    super(key, value, parseOptions)
  }

  /** throws */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(options?: void): T {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    if (!(this.typeGuard(this.value))) {
      const errorMessages: string[] = [
        `${getKeyDescription(this.key)} ${this.value} is not ${this.typeName}`,
      ]
      if (this.choises != null) {
        errorMessages.push(`choices are: [${this.choises}]`)
      }
      throw errorMessages.join(", ")
    }
    return this.value
  }
}


// ---- Game Object ---- //
export class RoomObjectIdArgument extends SingleOptionalArgument<{shouldVisible?: boolean}, Id<RoomObject & _HasId>> {
  /** throws */
  public parse(options?: { shouldVisible?: boolean }): Id<RoomObject & _HasId> {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const roomObject = Game.getObjectById(this.value)
    if (options?.shouldVisible === true && roomObject == null) {
      throw `No RoomObject with ID ${this.value} or not visible`
    }

    return this.value as Id<RoomObject & _HasId>
  }
}

export class RoomObjectArgument extends SingleOptionalArgument<void, RoomObject & _HasId> {
  /** throws */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(options?: void): RoomObject & _HasId {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const roomObject = Game.getObjectById(this.value)
    if (roomObject == null) {
      throw `No RoomObject with ID ${this.value} or not visible`
    }

    return roomObject as RoomObject & _HasId
  }
}

export class RoomArgument extends SingleOptionalArgument<{ my?: boolean }, Room> {
  /** throws */
  public parse(options?: { my?: boolean }): Room {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    validateRoomName(this.value, options) // options.my の検証も行っている

    const room = Game.rooms[this.value]
    if (room == null) {
      throw `No room with name ${this.value} or not visible`
    }
    return room
  }
}

export class MyRoomArgument extends SingleOptionalArgument<void, MyRoom> {
  /** throws */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(options?: void): MyRoom {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const room = Game.rooms[this.value]
    if (room == null) {
      throw `No room with name ${this.value} or not visible`
    }

    if (!isMyRoom(room)) {
      throw `Room ${ConsoleUtility.roomLink(room.name)} is not my room`
    }

    return room
  }
}

export class RoomNameArgument extends SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName> {
  /** throws */
  public parse(options?: { my?: boolean, allowClosedRoom?: boolean }): RoomName {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    validateRoomName(this.value, options)
    return this.value
  }
}

export class MyCreepArgument extends SingleOptionalArgument<void, Creep> {
  /** throws */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(options?: void): Creep {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const creep = Game.creeps[this.value]
    if (creep == null) {
      throw `No my creep named ${this.value}`
    }
    return creep
  }
}

export class HostileCreepArgument extends SingleOptionalArgument<void, Creep> {
  /** throws */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public parse(options?: void): Creep {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const creep = Game.getObjectById(this.value as Id<Creep>)
    if (creep == null) {
      throw `No my creep named ${this.value}`
    }
    return creep
  }
}

export class CreepBodyArgument extends SingleOptionalArgument<{ requiredEnergyLimit?: number }, CreepBody> {
  /** throws */
  public parse(options?: { requiredEnergyLimit?: number }): CreepBody {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const creepBody = CreepBody.createFromRawStringRepresentation(this.value)
    if (options?.requiredEnergyLimit != null) {
      if (creepBody.energyCost > options.requiredEnergyLimit) {
        throw `Creep body ${creepBody.stringRepresentation} requires ${creepBody.energyCost} energy (> ${options.requiredEnergyLimit})`
      }
    }
    return creepBody
  }
}

// ---- Parser ---- //
/** throws */
const parseIntValue = (key: ArgumentKey, value: string, options?: { min?: number, max?: number }): number => {
  const intValue = parseInt(value, 10)
  if (isNaN(intValue) === true) {
    throw `"${value}" is not an integer value`
  }
  validateNumberRange(key, intValue, options)
  return intValue
}

/** throws */
const validateNumberRange = (key: ArgumentKey, value: number, options?: { min?: number, max?: number }): void => {
  if (options?.min != null && value < options.min) {
    throw `${getKeyDescription(key)} is too small (${value} < ${options.min})`
  }
  if (options?.max != null && value > options.max) {
    throw `${getKeyDescription(key)} is too large (${value} > ${options.max})`
  }
}

/** throws */
const validateRoomName = (roomName: RoomName, options?: { my?: boolean, allowClosedRoom?: boolean }): void => {
  const roomStatus = Game.map.getRoomStatus(roomName)
  if (roomStatus == null) {
    throw `${roomName} is not a valid room name`
  }

  switch (roomStatus.status) {
  case "closed":
    if (options?.allowClosedRoom !== true) {
      throw `${ConsoleUtility.roomLink(roomName)} is closed`
    }
    break

  case "normal":
  case "novice":
  case "respawn":
    break
  }

  if (options?.my === true) {
    const room = Game.rooms[roomName]
    if (room == null || room.controller?.my !== true) {
      throw `${ConsoleUtility.roomLink(roomName)} is not mine`
    }
  }
}

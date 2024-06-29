import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Position } from "shared/utility/position"
import { RoomName } from "shared/utility/room_name_types"
import { AvailableRoomPositions } from "shared/utility/room_position"
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

export class StringArgument extends SingleOptionalArgument<void, string> {
  /** throws */
  public parse(): string {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    return this.value
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
  public parse(): T {
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

export class LocalPositionArgument extends SingleOptionalArgument<void, Position> {
  /** throws */
  public parse(): Position {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const [x, y] = ((): [AvailableRoomPositions, AvailableRoomPositions] => {
      const components = this.value.split(",")
      if (components[0] == null || components[1] == null || components.length !== 2) {
        throw `Invalid format ${this.value}. expected: "x,y"`
      }
      const parseOptions = { min: GameConstants.room.edgePosition.min, max: GameConstants.room.edgePosition.max }
      return [
        parseIntValue("x", components[0], parseOptions) as AvailableRoomPositions,
        parseIntValue("y", components[1], parseOptions) as AvailableRoomPositions,
      ]
    })()
    return {
      x,
      y,
    }
  }
}

export class CreepBodyArgument extends SingleOptionalArgument<{ requiredEnergyLimit?: number }, CreepBody> {
  /** throws */
  public parse(options: { requiredEnergyLimit?: number }): CreepBody {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const creepBody = CreepBody.createFromTextRepresentation(this.value)
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

import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { RoomName } from "shared/utility/room_name_types"

export type ArgumentKey = string | number
type Key = ArgumentKey

export type ArgumentParserOptions = {
  readonly errorMessage?: (rawArgument: string, error: string) => string
}

export abstract class SingleArgumentParser<Options, Value> {
  public constructor(
    public readonly key: Key,
    public readonly value: string | null,
    protected readonly parseOptions?: ArgumentParserOptions,
  ) {
  }

  /** throws */
  public abstract parse(options?: Options): Value

  protected missingArgumentErrorMessage(): string {
    return `Missing ${getKeyName(this.key)} argument`
  }
}

export abstract class SingleOptionalArgument<Options, Value> extends SingleArgumentParser<Options, Value> {
  /** throws */
  public abstract parse(options?: Options): Value

  /** throws */
  public parseOptional(options?: Options): Value | null {
    if (this.value == null) {
      return null
    }
    return this.parse(options)
  }
}


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


// ---- Utility ---- //
const getKeyName = (key: Key): string => {
  if (typeof key === "string") {
    return key
  }
  const index = key
  const indexName = ((): string => {
    switch (index % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
    }
  })()
  return `${index}${indexName}`
}



// ---- Parser ---- //
/** throws */
const parseIntValue = (key: Key, value: string, options?: { min?: number, max?: number }): number => {
  const intValue = parseInt(value, 10)
  if (isNaN(intValue) === true) {
    throw `${value} is not an integer value`
  }
  validateNumberRange(key, intValue, options)
  return intValue
}

/** throws */
const validateNumberRange = (key: Key, value: number, options?: { min?: number, max?: number }): void => {
  if (options?.min != null && value < options.min) {
    throw `${getKeyName(key)} is too small (${value} < ${options.min})`
  }
  if (options?.max != null && value > options.max) {
    throw `${getKeyName(key)} is too large (${value} > ${options.max})`
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

import { GameConstants } from "utility/constants"
import { isDirectionConstant } from "utility/direction"
import { roomLink } from "utility/log"
import type { RoomName } from "utility/room_name"

export abstract class SingleArgument<Options, Value> {
  public constructor(
    public readonly key: string,
    public readonly value: string | null,
  ) {
  }

  /** throws */
  public abstract parse(options?: Options): Value
}

export abstract class SingleOptionalArgument<Options, Value> extends SingleArgument<Options, Value> {
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

export class RoomNameArgument extends SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName> {
  /** throws */
  public parse(options?: { my?: boolean, allowClosedRoom?: boolean }): RoomName {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    validateRoomNameArgument(this.value, options)
    return this.value
  }
}

export class RoomNameListArgument extends SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName[]> {
  /** throws */
  public parse(options?: { my?: boolean, allowClosedRoom?: boolean }): RoomName[] {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    const roomNames = this.value.split(",")
    roomNames.forEach(roomName => validateRoomNameArgument(roomName, options))
    return roomNames
  }
}


/** throws */
function validateNumberRange(key: string, value: number, options?: { min?: number, max?: number }): void {
  if (options?.min != null && value < options.min) {
    throw `${key} is too small (${value} < ${options.min})`
  }
  if (options?.max != null && value > options.max) {
    throw `${key} is too large (${value} > ${options.max})`
  }
}

export class IntArgument extends SingleOptionalArgument<{ min?: number, max?: number }, number> {
  /** throws */
  public parse(options?: { min?: number, max?: number }): number {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    const intValue = parseIntValue(this.key, this.value, options)
    return intValue
  }
}

export class FloatArgument extends SingleOptionalArgument<{ min?: number, max?: number }, number> {
  /** throws */
  public parse(options?: { min?: number, max?: number }): number {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    const floatValue = parseFloat(this.value)
    if (isNaN(floatValue) === true) {
      throw `${this.value} is not an floating number`
    }
    validateNumberRange(this.key, floatValue, options)
    return floatValue
  }
}

export class StringArgument extends SingleOptionalArgument<void, string> {
  /** throws */
  public parse(): string {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    return this.value
  }
}

export function validateRoomNameArgument(roomName: RoomName, options?: { my?: boolean, allowClosedRoom?: boolean }): void {
  const roomStatus = Game.map.getRoomStatus(roomName)
  if (roomStatus == null) {
    throw `${roomName} is not a valid room name`
  }

  switch (roomStatus.status) {
  case "closed":
    if (options?.allowClosedRoom !== true) {
      throw `${roomLink(roomName)} is closed`
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
      throw `${roomLink(roomName)} is not mine`
    }
  }
}

export function missingArgumentErrorMessage(key: string): string {
  return `Missing ${key} argument`
}

/**
 * <x>,<y>
 */
export class LocalPositionArgument extends SingleOptionalArgument<void, { x: number, y: number }> {
  /** throws */
  public parse(): { x: number, y: number } {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    const [x, y] = ((): [number, number] => {
      const components = this.value.split(",")
      if (components[0] == null || components[1] == null) {
        throw `Invalid format ${this.value}. expected: &ltx&gt,&lty&gt`
      }
      const parseOptions = { min: GameConstants.room.edgePosition.min, max: GameConstants.room.edgePosition.max }
      return [
        parseIntValue("x", components[0], parseOptions),
        parseIntValue("y", components[1], parseOptions),
      ]
    })()
    return {
      x,
      y,
    }
  }
}

/** throws */
function parseIntValue(key: string, value: string, options?: { min?: number, max?: number }): number {
  const intValue = parseInt(value, 10)
  if (isNaN(intValue) === true) {
    throw `${value} is not an integer number`
  }
  validateNumberRange(key, intValue, options)
  return intValue
}

export class DirectionArgument extends SingleOptionalArgument<void, DirectionConstant> {
  /** throws */
  public parse(): DirectionConstant {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    const intValue = parseIntValue("direction", this.value)
    if (!isDirectionConstant(intValue)) {
      throw `${intValue} is not direction constant`
    }
    return intValue
  }
}

/**
 * <x>,<y>,<room name>
 */
export class RoomPositionArgument extends SingleOptionalArgument<{ allowClosedRoom?: boolean }, RoomPosition> {
  /** throws */
  public parse(options?: { allowClosedRoom?: boolean }): RoomPosition {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    const components = this.value.split(",")
    const roomName = components[2]
    if (components[0] == null || components[1] == null || roomName == null) {
      throw `Invalid format ${this.value}. expected: &ltx&gt,&lty&gt,&ltroom name&gt`
    }
    const parseOptions = { min: GameConstants.room.edgePosition.min, max: GameConstants.room.edgePosition.max }
    const x = parseIntValue("x", components[0], parseOptions)
    const y = parseIntValue("y", components[1], parseOptions)

    validateRoomNameArgument(roomName, options)

    return new RoomPosition(x, y, roomName)
  }
}

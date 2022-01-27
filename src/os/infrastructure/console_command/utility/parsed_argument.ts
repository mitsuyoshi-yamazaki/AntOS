import { roomLink } from "utility/log"
import type { RoomName } from "utility/room_name"

export abstract class SingleArgument<Options, Value> {
  public constructor(
    public readonly key: string,
    public readonly value: string | null,
  ) {
  }

  public abstract parse(options?: Options): Value
}

export abstract class SingleOptionalArgument<Options, Value> extends SingleArgument<Options, Value> {
  public abstract parse(options?: Options): Value

  public parseOptional(options?: Options): Value | null {
    if (this.value == null) {
      return null
    }
    return this.parse(options)
  }
}

export class RoomNameArgument extends SingleOptionalArgument<{ allowClosedRoom?: boolean }, RoomName> {
  public parse(options?: { allowClosedRoom?: boolean }): RoomName {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    validateRoomNameArgument(this.value, options)
    return this.value
  }
}

function validateNumberRange(key: string, value: number, options?: { min?: number, max?: number }): void {
  if (options?.min != null && value < options.min) {
    throw `${key} is too small (${value} < ${options.min})`
  }
  if (options?.max != null && value > options.max) {
    throw `${key} is too large (${value} > ${options.max})`
  }
}

export class IntArgument extends SingleOptionalArgument<{ min?: number, max?: number }, number> {
  public parse(options?: { min?: number, max?: number }): number {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    const intValue = parseInt(this.value, 10)
    if (isNaN(intValue) === true) {
      throw `${this.value} is not an integer number`
    }
    validateNumberRange(this.key, intValue, options)
    return intValue
  }
}

export class FloatArgument extends SingleOptionalArgument<{ min?: number, max?: number }, number> {
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
  public parse(): string {
    if (this.value == null) {
      throw missingArgumentErrorMessage(this.key)
    }
    return this.value
  }
}

export function validateRoomNameArgument(roomName: RoomName, options?: { allowClosedRoom?: boolean }): void {
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
}

export function missingArgumentErrorMessage(key: string): string {
  return `Missing ${key} argument`
}

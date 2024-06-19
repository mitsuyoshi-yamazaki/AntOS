import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { RoomName } from "shared/utility/room_name_types"
import { ArgumentKey, getKeyName, SingleOptionalArgument } from "./single_argument_parser"


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


// ---- Parser ---- //
/** throws */
const parseIntValue = (key: ArgumentKey, value: string, options?: { min?: number, max?: number }): number => {
  const intValue = parseInt(value, 10)
  if (isNaN(intValue) === true) {
    throw `${value} is not an integer value`
  }
  validateNumberRange(key, intValue, options)
  return intValue
}

/** throws */
const validateNumberRange = (key: ArgumentKey, value: number, options?: { min?: number, max?: number }): void => {
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

import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RoomResources } from "room_resource/room_resources"
import { GameConstants } from "utility/constants"
import { isDirectionConstant } from "shared/utility/direction"
import { isPowerConstant } from "shared/utility/power"
import type { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "../console_utility/console_utility"
import { Position } from "../position"
import { RoomCoordinate } from "utility/room_coordinate"

const roomLink = ConsoleUtility.roomLink

export type ArgumentParsingOptions = {
  missingArgumentErrorMessage?: string
}

export abstract class SingleArgument<Options, Value> {
  public constructor(
    public readonly key: string,
    public readonly value: string | null,
    protected readonly parseOptions?: ArgumentParsingOptions,
  ) {
  }

  /** throws */
  public abstract parse(options?: Options): Value

  protected missingArgumentErrorMessage(): string {
    return this.parseOptions?.missingArgumentErrorMessage ?? missingArgumentErrorMessage(this.key)
  }
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
      throw this.missingArgumentErrorMessage()
    }
    validateRoomNameArgument(this.value, options)
    return this.value
  }
}

export class RoomCoordinateArgument extends SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomCoordinate> {
  /** throws */
  public parse(options?: { my?: boolean, allowClosedRoom?: boolean }): RoomCoordinate {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    validateRoomNameArgument(this.value, options)

    const coordinate = RoomCoordinate.parse(this.value)
    if (coordinate == null) {
      throw `failed to parse ${roomLink(this.value)} to RoomCoordinate`
    }
    return coordinate
  }
}

export class RoomArgument extends SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, Room> {
  /** throws */
  public parse(options?: { my?: boolean, allowClosedRoom?: boolean }): Room {
    const roomNameArgument = new RoomNameArgument(this.key, this.value, this.parseOptions)
    const roomName = roomNameArgument.parse(options)
    const room = Game.rooms[roomName]
    if (room == null) {
      throw `no visible for ${roomLink(roomName)}`
    }
    return room
  }
}

export class RoomNameListArgument extends SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName[]> {
  /** throws */
  public parse(options?: { my?: boolean, allowClosedRoom?: boolean }): RoomName[] {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const roomNames = this.value.split(",")
    roomNames.forEach(roomName => validateRoomNameArgument(roomName, options))
    return roomNames
  }
}

export class TypedStringArgument<T extends string> extends SingleOptionalArgument<void, T> {
  public constructor(
    key: string,
    value: string | null,
    private readonly typeName: string,
    private readonly typeGuard: ((arg: string) => arg is T),
    parseOptions?: ArgumentParsingOptions,
  ) {
    super(key, value, parseOptions)
  }

  /** throws */
  public parse(): T {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    if (!(this.typeGuard(this.value))) {
      throw `${this.value} is not ${this.typeName}`
    }
    return this.value
  }
}

export class TypedStringListArgument<T extends string> extends SingleOptionalArgument<void, T[]> {
  public constructor(
    key: string,
    value: string | null,
    private readonly typeName: string,
    private readonly typeGuard: ((arg: string) => arg is T),
    parseOptions?: ArgumentParsingOptions,
  ) {
    super(key, value, parseOptions)
  }

  /** throws */
  public parse(): T[] {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const components = this.value.split(",")
    return components.map(component => {
      if (!(this.typeGuard(component))) {
        throw `${component} is not ${this.typeName}`
      }
      return component
    })
  }
}

export class PowerTypeArgument extends SingleOptionalArgument<void, PowerConstant> {
  /** throws */
  public parse(): PowerConstant {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const intValue = parseIntValue(this.key, this.value)
    if (!(isPowerConstant(intValue))) {
      throw `${intValue} is not power type`
    }
    return intValue
  }
}

export class CreepArgument extends SingleOptionalArgument<void, Creep> {
  /** throws */
  public parse(): Creep {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const creep = Game.creeps[this.value]
    if (!(creep instanceof Creep)) {
      throw `no creep with name ${this.value}`
    }
    return creep
  }
}

export class PowerCreepArgument extends SingleOptionalArgument<void, PowerCreep> {
  /** throws */
  public parse(): PowerCreep {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const creep = Game.powerCreeps[this.value]
    if (!(creep instanceof PowerCreep)) {
      throw `no power creep with name ${this.value}`
    }
    return creep
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

export class RawStringArgument extends SingleOptionalArgument<void, string> {
  /** throws */
  public parse(): string {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    return this.value
  }
}

/**
 * allowSpacing: '\\'をスペースに置換する
 */
export class StringArgument extends SingleOptionalArgument<{allowSpacing?: boolean}, string> {
  /** throws */
  public parse(options?: { allowSpacing?: boolean }): string {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    if (options?.allowSpacing === true) {
      return this.value.replace(/\\/g, " ")
    }
    return this.value
  }
}

// export class StringOrIntArgument extends SingleOptionalArgument<{ min?: number, max?: number }, string | number> {
//   /** throws */
//   public parse(options?: { min?: number, max?: number }): string | number {
//     if (this.value == null) {
//       throw this.missingArgumentErrorMessage()
//     }

//     try {
//       const intValue = parseIntValue(this.key, this.value, options)
//       return intValue
//     }

//     return this.value
//   }
// }

export class StringListArgument extends SingleOptionalArgument<void, string[]> {
  /** throws */
  public parse(): string[] {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    return this.value.split(",")
  }
}

export class BooleanArgument extends SingleOptionalArgument<void, boolean> {
  /** throws */
  public parse(): boolean {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    switch (this.value) {
    case "0":
      return false
    case "1":
      return true
    default:
      throw `Invalid boolean value ${this.value}, set 0 or 1`
    }
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
export class LocalPositionArgument extends SingleOptionalArgument<void, Position> {
  /** throws */
  public parse(): Position {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
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

/**
 * <x>,<y>;<x>,<y>;...
 */
export class LocalPositionsArgument extends SingleOptionalArgument<void, Position[]> {
  /** throws */
  public parse(): Position[] {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const parseOptions = { min: GameConstants.room.edgePosition.min, max: GameConstants.room.edgePosition.max }
    const parsePosition = (rawValue: string): Position => {
      const components = rawValue.split(",")
      if (components[0] == null || components[1] == null) {
        throw `Invalid format ${this.value}. expected: &ltx&gt,&lty&gt;&ltx&gt,&lty&gt;...`
      }
      return {
        x: parseIntValue("x", components[0], parseOptions),
        y: parseIntValue("y", components[1], parseOptions),
      }
    }
    return this.value.split(";").map(rawValue => parsePosition(rawValue))
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
      throw this.missingArgumentErrorMessage()
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
      throw this.missingArgumentErrorMessage()
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

export class OwnedRoomResourceArgument extends SingleOptionalArgument<void, OwnedRoomResource> {
  /** throws */
  public parse(): OwnedRoomResource {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    validateRoomNameArgument(this.value)

    const roomResource = RoomResources.getOwnedRoomResource(this.value)
    if (roomResource == null) {
      throw `${roomLink(this.value)} is not mine`
    }
    return roomResource
  }
}

export class GameObjectIdArgument extends SingleOptionalArgument<void, Id<RoomObject>> {
  /** throws */
  public parse(): Id<RoomObject> {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    if (this.value.length <= 0) {
      throw "ID cannot be empty string"
    }
    return this.value as Id<RoomObject>
  }
}

export class VisibleRoomObjectArgument extends SingleOptionalArgument<{ inRoomName?: RoomName }, RoomObject> {
  /** throws */
  public parse(options?: { inRoomName?: RoomName }): RoomObject {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }
    const obj = Game.getObjectById(this.value as Id<RoomObject>)
    if (obj == null) {
      throw `no object with ID ${this.value}`
    }
    if (obj.room == null) {
      throw `object doesn't have room reference ${obj}`
    }
    if (options?.inRoomName != null && obj.room.name !== options.inRoomName) {
      throw `${obj} is not in ${roomLink(options.inRoomName)} (${roomLink(obj.room.name)})`
    }
    return obj
  }
}

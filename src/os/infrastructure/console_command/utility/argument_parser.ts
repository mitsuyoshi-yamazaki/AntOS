import { GameMap } from "game/game_map"
import { roomLink } from "utility/log"
import type { RoomName } from "utility/room_name"

interface SingleArgumentInterface<Options, Value> {
  parse(options?: Options): Value
  parseOptional(options?: Options): Value | null
}

/**
 * - 各メソッドはパース/検証に失敗した場合に例外を送出する
 */
interface StringArgumentsInterface {
  roomName(key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomName>
  int(key: string): SingleArgument<{ min?: number, max?: number }, number>
  float(key: string): SingleArgument<{ min?: number, max?: number }, number>
  string(key: string): SingleArgument<void, string>

  interRoomPath(
    fromRoomKey: string,
    waypointsKey: string,
    toRoomKey: string,
    options?: { ignoreStoredWaypoints?: boolean, skipStore?: boolean, allowClosedRoom?: boolean }
  ): {
    fromRoomName: RoomName,
    toRoomName: RoomName,
    waypoints: RoomName[]
  }
}

export class StringArguments implements StringArgumentsInterface {
  private readonly argumentMap: Map<string, string>

  public constructor(
    rawArguments: string[],
  ) {
    this.argumentMap = new Map<string, string>()
    rawArguments.forEach(pair => {
      const [key, value] = pair.split("=")
      if (key == null || value == null) {
        return
      }
      this.argumentMap.set(key, value)
    })
  }

  public roomName(key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomName> {
    return new RoomNameArgument(key, this.argumentMap.get(key) ?? null)
  }

  public int(key: string): SingleArgument<{ min?: number, max?: number }, number> {
    return new IntArgument(key, this.argumentMap.get(key) ?? null)
  }

  public float(key: string): SingleArgument<{ min?: number, max?: number }, number> {
    return new FloatArgument(key, this.argumentMap.get(key) ?? null)
  }

  public string(key: string): SingleArgument<void, string> {
    return new StringArgument(key, this.argumentMap.get(key) ?? null)
  }

  public interRoomPath(
    fromRoomKey: string,
    waypointsKey: string,
    toRoomKey: string,
    options?: { ignoreStoredWaypoints?: boolean, skipStore?: boolean, allowClosedRoom?: boolean }
  ): {
    fromRoomName: RoomName,
    toRoomName: RoomName,
    waypoints: RoomName[]
  } {
    const fromRoomName = this.roomName(fromRoomKey).parse(options)
    const toRoomName = this.roomName(toRoomKey).parse(options)

    const parseWaypoints = (): RoomName[] | null => {
      const argumentValue = this.argumentMap.get(waypointsKey)
      if (argumentValue == null) {
        return null
      }
      const roomNames = argumentValue.split(",")
      roomNames.forEach(roomName => validateRoomName(roomName, options))
      return roomNames
    }

    const waypoints = ((): RoomName[] => {
      if (options?.ignoreStoredWaypoints === true) {
        const roomNames = parseWaypoints()
        if (roomNames == null) {
          throw missingArgumentError(waypointsKey)
        }
        return roomNames
      }

      const roomNames = parseWaypoints()
      if (roomNames != null) {
        if (options?.skipStore !== true) {
          GameMap.setWaypoints(fromRoomName, toRoomName, roomNames)
        }
        return roomNames
      }

      const storedWaypoints = GameMap.getWaypoints(fromRoomName, toRoomName)
      if (storedWaypoints == null) {
        throw `Argument ${waypointsKey} not set and no stored waypoints from ${roomLink(fromRoomName)} to ${roomLink(toRoomName)}`
      }
      return storedWaypoints
    })()

    return {
      fromRoomName,
      toRoomName,
      waypoints,
    }
  }
}

function validateRoomName(roomName: RoomName, options?: { allowClosedRoom?: boolean }): void {
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

function missingArgumentError(key: string): string {
  return `Missing ${key} argument`
}

abstract class SingleArgument<Options, Value> implements SingleArgumentInterface<Options, Value> {
  public constructor(
    public readonly key: string,
    public readonly value: string | null,
  ) {
  }

  public abstract parse(options?: Options): Value

  public parseOptional(options?: Options): Value | null {
    if (this.value == null) {
      return null
    }
    return this.parse(options)
  }
}

class RoomNameArgument extends SingleArgument<{ allowClosedRoom?: boolean }, RoomName> {
  public parse(options?: { allowClosedRoom?: boolean }): RoomName {
    if (this.value == null) {
      throw missingArgumentError(this.key)
    }
    validateRoomName(this.value, options)
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

class IntArgument extends SingleArgument<{ min?: number, max?: number }, number> {
  public parse(options?: { min?: number, max?: number }): number {
    if (this.value == null) {
      throw missingArgumentError(this.key)
    }
    const intValue = parseInt(this.value, 10)
    if (isNaN(intValue) === true) {
      throw `${this.value} is not an integer number`
    }
    validateNumberRange(this.key, intValue, options)
    return intValue
  }
}

class FloatArgument extends SingleArgument<{ min?: number, max?: number }, number> {
  public parse(options?: { min?: number, max?: number }): number {
    if (this.value == null) {
      throw missingArgumentError(this.key)
    }
    const floatValue = parseFloat(this.value)
    if (isNaN(floatValue) === true) {
      throw `${this.value} is not an floating number`
    }
    validateNumberRange(this.key, floatValue, options)
    return floatValue
  }
}

class StringArgument extends SingleArgument<void, string> {
  public parse(): string {
    if (this.value == null) {
      throw missingArgumentError(this.key)
    }
    return this.value
  }
}

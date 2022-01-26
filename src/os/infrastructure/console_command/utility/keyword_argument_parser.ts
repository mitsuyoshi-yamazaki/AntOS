import { GameMap } from "game/game_map"
import { roomLink } from "utility/log"
import type { RoomName } from "utility/room_name"
import { FloatArgument, IntArgument, missingArgumentErrorMessage, RoomNameArgument, SingleOptionalArgument, StringArgument, validateRoomNameArgument } from "./parsed_argument"

/**
 * - 各メソッドはパース/検証に失敗した場合に例外を送出する
 */
interface KeywordArgumentsInterface {
  // ---- Primitive Type ---- //
  int(key: string): SingleOptionalArgument<{ min?: number, max?: number }, number>
  float(key: string): SingleOptionalArgument<{ min?: number, max?: number }, number>
  string(key: string): SingleOptionalArgument<void, string>

  // ---- Game Object ---- //
  roomName(key: string): SingleOptionalArgument<{ allowClosedRoom?: boolean }, RoomName>
  gameObjectId(key: string): SingleOptionalArgument<void, string>

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

export class KeywordArguments implements KeywordArgumentsInterface {
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

  public int(key: string): SingleOptionalArgument<{ min?: number, max?: number }, number> {
    return new IntArgument(key, this.argumentMap.get(key) ?? null)
  }

  public float(key: string): SingleOptionalArgument<{ min?: number, max?: number }, number> {
    return new FloatArgument(key, this.argumentMap.get(key) ?? null)
  }

  public string(key: string): SingleOptionalArgument<void, string> {
    return new StringArgument(key, this.argumentMap.get(key) ?? null)
  }

  public roomName(key: string): SingleOptionalArgument<{ allowClosedRoom?: boolean }, RoomName> {
    return new RoomNameArgument(key, this.argumentMap.get(key) ?? null)
  }

  public gameObjectId(key: string): SingleOptionalArgument<void, string> {
    return this.string(key)
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
      roomNames.forEach(roomName => validateRoomNameArgument(roomName, options))
      return roomNames
    }

    const waypoints = ((): RoomName[] => {
      if (options?.ignoreStoredWaypoints === true) {
        const roomNames = parseWaypoints()
        if (roomNames == null) {
          throw missingArgumentErrorMessage(waypointsKey)
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

import { GameMap } from "game/game_map"
import { roomLink } from "utility/log"
import type { RoomName } from "utility/room_name"
import { BooleanArgument, DirectionArgument, FloatArgument, IntArgument, LocalPositionArgument, missingArgumentErrorMessage, RoomNameArgument, RoomNameListArgument, RoomPositionArgument, SingleOptionalArgument, StringArgument, validateRoomNameArgument } from "./argument_parser"

/**
 * - 各メソッドはパース/検証に失敗した場合に例外を送出する
 */
interface KeywordArgumentsInterface {
  // ---- Primitive Type ---- //
  int(key: string): SingleOptionalArgument<{ min?: number, max?: number }, number>
  float(key: string): SingleOptionalArgument<{ min?: number, max?: number }, number>
  string(key: string): SingleOptionalArgument<void, string>
  boolean(key: string): SingleOptionalArgument<void, boolean>
 localPosition(key: string): SingleOptionalArgument<void, { x: number, y: number }>

  // ---- Game Object ---- //
  direction(key: string): SingleOptionalArgument<void, DirectionConstant>
  roomPosition(key: string): SingleOptionalArgument<{ allowClosedRoom?: boolean }, RoomPosition>
  roomName(key: string): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName>
  roomNameList(key: string): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName[]>
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

  public boolean(key: string): SingleOptionalArgument<void, boolean> {
    return new BooleanArgument(key, this.argumentMap.get(key) ?? null)
  }

  public localPosition(key: string): SingleOptionalArgument<void, { x: number, y: number }> {
    return new LocalPositionArgument(key, this.argumentMap.get(key) ?? null)
  }

  public direction(key: string): SingleOptionalArgument<void, DirectionConstant> {
    return new DirectionArgument(key, this.argumentMap.get(key) ?? null)
  }

  public roomPosition(key: string): SingleOptionalArgument<{ allowClosedRoom?: boolean }, RoomPosition> {
    return new RoomPositionArgument(key, this.argumentMap.get(key) ?? null)
  }

  public roomName(key: string): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName> {
    return new RoomNameArgument(key, this.argumentMap.get(key) ?? null)
  }

  public roomNameList(key: string): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName[]> {
    return new RoomNameListArgument(key, this.argumentMap.get(key) ?? null)
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

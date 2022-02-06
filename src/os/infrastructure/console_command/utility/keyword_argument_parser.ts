import { GameMap } from "game/game_map"
import { roomLink } from "utility/log"
import { isCommodityConstant, isDepositConstant, isMineralBoostConstant, isResourceConstant } from "utility/resource"
import type { RoomName } from "utility/room_name"
import { ArgumentParsingOptions, BooleanArgument, DirectionArgument, FloatArgument, IntArgument, LocalPositionArgument, missingArgumentErrorMessage, ResourceTypeArgument, RoomArgument, RoomNameArgument, RoomNameListArgument, RoomPositionArgument, SingleOptionalArgument, StringArgument, validateRoomNameArgument } from "./argument_parser"

/**
 * - 各メソッドはパース/検証に失敗した場合に例外を送出する
 */
interface KeywordArgumentsInterface {
  // ---- Primitive Type ---- //
  int(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ min?: number, max?: number }, number>
  float(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ min?: number, max?: number }, number>
  string(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, string>
  boolean(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, boolean>
  localPosition(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, { x: number, y: number }>

  // ---- Game Object ---- //
  direction(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, DirectionConstant>
  roomPosition(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ allowClosedRoom?: boolean }, RoomPosition>
  roomName(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName>
  roomNameList(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName[]>
  room(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, Room>
  gameObjectId(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, string>
  resourceType(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, ResourceConstant>
  boostCompoundType(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, MineralBoostConstant>
  depositType(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, DepositConstant>
  commodityType(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, CommodityConstant>

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

  public constructor(rawArguments: string[])
  public constructor(rawArguments: Map<string, string>)
  public constructor(
    rawArguments: string[] | Map<string, string>,
  ) {
    if (rawArguments instanceof Map) {
      this.argumentMap = new Map(rawArguments)
      return
    }

    this.argumentMap = new Map<string, string>()
    rawArguments.forEach(pair => {
      const [key, value] = pair.split("=")
      if (key == null || value == null) {
        return
      }
      this.argumentMap.set(key, value)
    })
  }

  public int(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ min?: number, max?: number }, number> {
    return new IntArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public float(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ min?: number, max?: number }, number> {
    return new FloatArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public string(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, string> {
    return new StringArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public boolean(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, boolean> {
    return new BooleanArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public localPosition(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, { x: number, y: number }> {
    return new LocalPositionArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public direction(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, DirectionConstant> {
    return new DirectionArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public roomPosition(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ allowClosedRoom?: boolean }, RoomPosition> {
    return new RoomPositionArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public roomName(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName> {
    return new RoomNameArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public roomNameList(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName[]> {
    return new RoomNameListArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public room(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<{ my?: boolean, allowClosedRoom?: boolean }, Room> {
    return new RoomArgument(key, this.argumentMap.get(key) ?? null, options)
  }

  public gameObjectId(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, string> {
    return this.string(key, options)
  }

  public resourceType(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, ResourceConstant> {
    return new ResourceTypeArgument(key, this.argumentMap.get(key) ?? null, "ResourceConstant", isResourceConstant, options)
  }

  public boostCompoundType(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, MineralBoostConstant> {
    return new ResourceTypeArgument(key, this.argumentMap.get(key) ?? null, "MineralBoostConstant", isMineralBoostConstant, options)
  }

  public depositType(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, DepositConstant> {
    return new ResourceTypeArgument(key, this.argumentMap.get(key) ?? null, "DepositConstant", isDepositConstant, options)
  }

  public commodityType(key: string, options?: ArgumentParsingOptions): SingleOptionalArgument<void, CommodityConstant> {
    return new ResourceTypeArgument(key, this.argumentMap.get(key) ?? null, "CommodityConstant", isCommodityConstant, options)
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

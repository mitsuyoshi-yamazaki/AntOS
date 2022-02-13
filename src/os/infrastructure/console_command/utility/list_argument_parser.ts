import { Position } from "prototype/room_position"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { isCommodityConstant, isDepositConstant, isMineralBoostConstant, isResourceConstant } from "utility/resource"
import { RoomCoordinate, RoomName } from "utility/room_name"
import { ArgumentParsingOptions, BooleanArgument, CreepArgument, DirectionArgument, FloatArgument, IntArgument, LocalPositionArgument, LocalPositionsArgument, OwnedRoomResourceArgument, PowerCreepArgument, PowerTypeArgument, TypedStringArgument, RoomArgument, RoomCoordinateArgument, RoomNameArgument, RoomNameListArgument, RoomPositionArgument, SingleArgument, StringArgument, StringListArgument } from "./argument_parser"
import { IterableArgumentType, IterableArgument } from "./iterable_argument_parser"

/**
 * - 各メソッドはパース/検証に失敗した場合に例外を送出する
 */
interface KeywordArgumentsInterface {
  has(index: number): boolean

  // ---- Primitive Type ---- //
  int(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ min?: number, max?: number }, number>
  float(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ min?: number, max?: number }, number>
  string(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, string>
  boolean(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, boolean>
  list<T extends IterableArgumentType>(index: number, key: string, argumentType: T, options?: ArgumentParsingOptions): IterableArgument<T>
  localPosition(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, Position>
  localPositions(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, Position[]>

  // ---- Game Object ---- //
  direction(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, DirectionConstant>
  roomPosition(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, RoomPosition>
  roomName(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ my?: boolean,  allowClosedRoom?: boolean }, RoomName>
  roomNameList(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ my?: boolean,  allowClosedRoom?: boolean }, RoomName[]>
  room(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ my?: boolean,  allowClosedRoom?: boolean }, Room>
  gameObjectId(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, string>
  resourceType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, ResourceConstant>
  boostCompoundType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, MineralBoostConstant>
  depositType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, DepositConstant>
  commodityType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, CommodityConstant>
  powerType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, PowerConstant>
  creep(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, Creep>
  powerCreep(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, PowerCreep>

  // ---- Custom Type ---- //
  ownedRoomResource(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, OwnedRoomResource>
  roomCoordinate(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomCoordinate>
  typedString<T extends string>(index: number, key: string, typeName: string, typeGuard: ((arg: string) => arg is T), options?: ArgumentParsingOptions): SingleArgument<void, T>
}

export class ListArguments implements KeywordArgumentsInterface {
  public constructor(
    private readonly argumentList: string[]
  ) {
  }

  public has(index: number): boolean {
    return this.argumentList.length > index
  }

  // ---- Primitive Type ---- //
  public int(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ min?: number, max?: number }, number> {
    return new IntArgument(key, this.getValueAt(index, key), options)
  }

  public float(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ min?: number, max?: number }, number> {
    return new FloatArgument(key, this.getValueAt(index, key), options)
  }

  public string(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, string> {
    return new StringArgument(key, this.getValueAt(index, key), options)
  }

  public stringList(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, string[]> {
    return new StringListArgument(key, this.getValueAt(index, key), options)
  }

  public boolean(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, boolean> {
    return new BooleanArgument(key, this.getValueAt(index, key), options)
  }

  public list<T extends IterableArgumentType>(index: number, key: string, argumentType: T, options?: ArgumentParsingOptions): IterableArgument<T> {
    return IterableArgument.create(key, this.getValueAt(index, key), argumentType, options)
  }

  public localPosition(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, Position> {
    return new LocalPositionArgument(key, this.getValueAt(index, key), options)
  }

  public localPositions(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, Position[]> {
    return new LocalPositionsArgument(key, this.getValueAt(index, key), options)
  }

  // ---- Game Object ---- //
  public direction(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, DirectionConstant> {
    return new DirectionArgument(key, this.getValueAt(index, key), options)
  }

  public roomPosition(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, RoomPosition> {
    return new RoomPositionArgument(key, this.getValueAt(index, key), options)
  }

  public roomName(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ my?: boolean,  allowClosedRoom?: boolean }, RoomName> {
    return new RoomNameArgument(key, this.getValueAt(index, key), options)
  }

  public roomNameList(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomName[]> {
    return new RoomNameListArgument(key, this.getValueAt(index, key), options)
  }

  public room(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ my?: boolean,  allowClosedRoom?: boolean }, Room> {
    return new RoomArgument(key, this.getValueAt(index, key), options)
  }

  public gameObjectId(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, string> {
    return this.string(index, key, options)
  }

  public resourceType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, ResourceConstant> {
    return new TypedStringArgument(key, this.getValueAt(index, key), "ResourceConstant", isResourceConstant, options)
  }

  public boostCompoundType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, MineralBoostConstant> {
    return new TypedStringArgument(key, this.getValueAt(index, key), "MineralBoostConstant", isMineralBoostConstant, options)
  }

  public depositType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, DepositConstant> {
    return new TypedStringArgument(key, this.getValueAt(index, key), "DepositConstant", isDepositConstant, options)
  }

  public commodityType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, CommodityConstant> {
    return new TypedStringArgument(key, this.getValueAt(index, key), "CommodityConstant", isCommodityConstant, options)
  }

  public powerType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, PowerConstant> {
    return new PowerTypeArgument(key, this.getValueAt(index, key), options)
  }

  public creep(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, Creep> {
    return new CreepArgument(key, this.getValueAt(index, key), options)
  }

  public powerCreep(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, PowerCreep> {
    return new PowerCreepArgument(key, this.getValueAt(index, key), options)
  }

  // ---- Custom Type ---- //
  public ownedRoomResource(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, OwnedRoomResource> {
    return new OwnedRoomResourceArgument(key, this.getValueAt(index, key), options)
  }

  public roomCoordinate(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ my?: boolean, allowClosedRoom?: boolean }, RoomCoordinate> {
    return new RoomCoordinateArgument(key, this.getValueAt(index, key), options)
  }

  public typedString<T extends string>(index: number, key: string, typeName: string, typeGuard: ((arg: string) => arg is T), options?: ArgumentParsingOptions): SingleArgument<void, T> {
    return new TypedStringArgument(key, this.getValueAt(index, key), typeName, typeGuard, options)
  }

  // ---- ---- //
  private getValueAt(index: number, key: string): string {
    const value = this.argumentList[index]
    if (value == null) {
      const argumentDetail = this.argumentList.length <= 0 ? "no arguments given" : `(given arguments: ${this.argumentList.join(" ")})`
      throw `Missing ${index}th argument ${key}, ${argumentDetail}`
    }
    return value
  }
}

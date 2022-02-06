import { isCommodityConstant, isDepositConstant, isMineralBoostConstant, isResourceConstant } from "utility/resource"
import type { RoomName } from "utility/room_name"
import { ArgumentParsingOptions, BooleanArgument, DirectionArgument, FloatArgument, IntArgument, LocalPositionArgument, ResourceTypeArgument, RoomArgument, RoomNameArgument, RoomNameListArgument, RoomPositionArgument, SingleArgument, StringArgument } from "./argument_parser"

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
  localPosition(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, {x: number, y: number}>

  // ---- Game Object ---- //
  direction(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, DirectionConstant>
  roomPosition(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, RoomPosition>
  roomName(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, RoomName>
  roomNameList(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, RoomName[]>
  room(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, Room>
  gameObjectId(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, string>
  resourceType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, ResourceConstant>
  boostCompoundType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, MineralBoostConstant>
  depositType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, DepositConstant>
  commodityType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, CommodityConstant>
}

export class ListArguments implements KeywordArgumentsInterface {
  public constructor(
    private readonly argumentList: string[]
  ) {
  }

  public has(index: number): boolean {
    return this.argumentList.length > index
  }

  public int(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ min?: number, max?: number }, number> {
    return new IntArgument(key, this.getValueAt(index), options)
  }

  public float(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ min?: number, max?: number }, number> {
    return new FloatArgument(key, this.getValueAt(index), options)
  }

  public string(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, string> {
    return new StringArgument(key, this.getValueAt(index), options)
  }

  public boolean(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, boolean> {
    return new BooleanArgument(key, this.getValueAt(index), options)
  }

  public localPosition(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, { x: number, y: number }> {
    return new LocalPositionArgument(key, this.getValueAt(index), options)
  }

  public direction(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, DirectionConstant> {
    return new DirectionArgument(key, this.getValueAt(index), options)
  }

  public roomPosition(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, RoomPosition> {
    return new RoomPositionArgument(key, this.getValueAt(index), options)
  }

  public roomName(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, RoomName> {
    return new RoomNameArgument(key, this.getValueAt(index), options)
  }

  public roomNameList(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, RoomName[]> {
    return new RoomNameListArgument(key, this.getValueAt(index), options)
  }

  public room(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<{ allowClosedRoom?: boolean }, Room> {
    return new RoomArgument(key, this.getValueAt(index), options)
  }

  public gameObjectId(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, string> {
    return this.string(index, key, options)
  }

  public resourceType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, ResourceConstant> {
    return new ResourceTypeArgument(key, this.getValueAt(index), "ResourceConstant", isResourceConstant, options)
  }

  public boostCompoundType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, MineralBoostConstant> {
    return new ResourceTypeArgument(key, this.getValueAt(index), "MineralBoostConstant", isMineralBoostConstant, options)
  }

  public depositType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, DepositConstant> {
    return new ResourceTypeArgument(key, this.getValueAt(index), "DepositConstant", isDepositConstant, options)
  }

  public commodityType(index: number, key: string, options?: ArgumentParsingOptions): SingleArgument<void, CommodityConstant> {
    return new ResourceTypeArgument(key, this.getValueAt(index), "CommodityConstant", isCommodityConstant, options)
  }

  // ---- ---- //
  private getValueAt(index: number): string {
    const value = this.argumentList[index]
    if (value == null) {
      throw `Missing ${index}th argument (arguments: ${this.argumentList.join(" ")})`
    }
    return value
  }
}

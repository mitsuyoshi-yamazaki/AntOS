import type { RoomName } from "utility/room_name"
import { DirectionArgument, FloatArgument, IntArgument, LocalPositionArgument, RoomNameArgument, RoomNameListArgument, RoomPositionArgument, SingleArgument, StringArgument } from "./argument_parser"

/**
 * - 各メソッドはパース/検証に失敗した場合に例外を送出する
 */
interface KeywordArgumentsInterface {
  has(index: number): boolean

  // ---- Primitive Type ---- //
  int(index: number, key: string): SingleArgument<{ min?: number, max?: number }, number>
  float(index: number, key: string): SingleArgument<{ min?: number, max?: number }, number>
  string(index: number, key: string): SingleArgument<void, string>
  localPosition(index: number, key: string): SingleArgument<void, {x: number, y: number}>

  // ---- Game Object ---- //
  direction(index: number, key: string): SingleArgument<void, DirectionConstant>
  roomPosition(index: number, key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomPosition>
  roomName(index: number, key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomName>
  roomNameList(index: number, key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomName[]>
  gameObjectId(index: number, key: string): SingleArgument<void, string>
}

export class ListArguments implements KeywordArgumentsInterface {
  public constructor(
    private readonly argumentList: string[]
  ) {
  }

  public has(index: number): boolean {
    return this.argumentList.length > index
  }

  public int(index: number, key: string): SingleArgument<{ min?: number, max?: number }, number> {
    return new IntArgument(key, this.getValueAt(index))
  }

  public float(index: number, key: string): SingleArgument<{ min?: number, max?: number }, number> {
    return new FloatArgument(key, this.getValueAt(index))
  }

  public string(index: number, key: string): SingleArgument<void, string> {
    return new StringArgument(key, this.getValueAt(index))
  }

  public localPosition(index: number, key: string): SingleArgument<void, { x: number, y: number }> {
    return new LocalPositionArgument(key, this.getValueAt(index))
  }

  public direction(index: number, key: string): SingleArgument<void, DirectionConstant> {
    return new DirectionArgument(key, this.getValueAt(index))
  }

  public roomPosition(index: number, key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomPosition> {
    return new RoomPositionArgument(key, this.getValueAt(index))
  }

  public roomName(index: number, key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomName> {
    return new RoomNameArgument(key, this.getValueAt(index))
  }

  public roomNameList(index: number, key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomName[]> {
    return new RoomNameListArgument(key, this.getValueAt(index))
  }

  public gameObjectId(index: number, key: string): SingleArgument<void, string> {
    return this.string(index, key)
  }

  private getValueAt(index: number): string {
    const value = this.argumentList[index]
    if (value == null) {
      throw `Missing ${index}th argument (arguments: ${this.argumentList.join(" ")})`
    }
    return value
  }
}

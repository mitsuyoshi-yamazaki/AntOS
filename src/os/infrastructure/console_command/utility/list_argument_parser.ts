import type { RoomName } from "utility/room_name"
import { FloatArgument, IntArgument, RoomNameArgument, SingleArgument, StringArgument } from "./parsed_argument"

/**
 * - 各メソッドはパース/検証に失敗した場合に例外を送出する
 */
interface KeywardArgumentsInterface {
  // ---- Primitive Type ---- //
  int(index: number, key: string): SingleArgument<{ min?: number, max?: number }, number>
  float(index: number, key: string): SingleArgument<{ min?: number, max?: number }, number>
  string(index: number, key: string): SingleArgument<void, string>

  // ---- Game Object ---- //
  roomName(index: number, key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomName>
  gameObjectId(index: number, key: string): SingleArgument<void, string>
}

export class ListArguments implements KeywardArgumentsInterface {
  public constructor(
    private readonly argumentList: string[]
  ) {
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

  public roomName(index: number, key: string): SingleArgument<{ allowClosedRoom?: boolean }, RoomName> {
    return new RoomNameArgument(key, this.getValueAt(index))
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

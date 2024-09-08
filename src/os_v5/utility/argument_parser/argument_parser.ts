import { ArgumentKey, ArgumentParserOptions } from "./single_argument_parser"
import { BoolArgument, CreepBodyArgument, FloatArgument, HostileCreepArgument, IntArgument, LocalPositionArgument, MyCreepArgument, MyRoomArgument, RangeArgument, RoomArgument, RoomNameArgument, RoomObjectArgument, RoomObjectIdArgument, StringArgument, TypedStringArgument } from "./single_argument_parsers"
import { IterableArgumentType, ListArgumentParser } from "./list_argument_parser"

/**
# ArgumentParser
## 要件
- 配列引数とキーワード引数をパースする

## 仕様
- スペースで区切られた引数のうち、keyとvalueが=で紐づけられているものがキーワード引数
- 配列引数は添字で指定するため、キーワード引数より前に指定する
 */

/// ListかKeywordかは=が出てくるまで不明
type ParsedArgumentUnknown = {
  readonly case: "unknown"
  value: string
}
/// Argumentが'で囲われている場合
type ParsedArgumentList = {
  readonly case: "list"
  value: string
}
type ParsedArgumentKeyword = {
  readonly case: "keyword"
  readonly key: string
  value: string
  isInQuotation: boolean
}
type ParsedArgumentOption = {
  readonly case: "option"
  readonly values: string[]
}
type ParsedArgument = ParsedArgumentUnknown | ParsedArgumentList | ParsedArgumentKeyword | ParsedArgumentOption

export class ArgumentParser {
  public get isEmpty(): boolean {
    return Array.from(this.rawKeywordArguments.values()).length === 0 && this.rawArguments.length <= this.rawArgumentOffset
  }

  protected rawArgumentOffset = 0
  protected readonly rawArguments: string[] = []
  protected readonly rawKeywordArguments = new Map<string, string>()
  protected readonly optionArguments: Set<string>

  /** @throws */
  public constructor(
    rawArgument: string,
  ) {
    const optionArguments: string[] = []

    let currentArgument = {
      case: "unknown",
      value: "",
    } as ParsedArgument

    rawArgument.split("").forEach(c => {
      switch (currentArgument.case) {
      case "unknown":
        switch (c) {
        case "'":
          if (currentArgument.value.length > 0) {
            throw `Unexpected ' in middle of unknown type argument: ${currentArgument.value + c}`
          }
          currentArgument = {
            case: "list",
            value: "",
          }
          return

        case " ":
          if (currentArgument.value.length > 0) {
            // ' で終わった等で、値を読み出す前にスペースに来ることがある
            this.rawArguments.push(currentArgument.value)
            currentArgument = {
              case: "unknown",
              value: "",
            }
          }
          return

        case "=": {
          const key = currentArgument.value
          currentArgument = {
            case: "keyword",
            key,
            value: "",
            isInQuotation: false,
          }
          return
        }

        case "-":
          if (currentArgument.value.length > 0) {
            throw `Unexpected - in middle of argument: ${currentArgument.value + c}`
          }
          currentArgument = {
            case: "option",
            values: [],
          }
          return

        default: {
          currentArgument.value += c
          return
        }
        }

      case "list": // ' から始まっている場合のみ
        if (this.rawKeywordArguments.size > 0) {
          throw "List argument comes after keyword arguments"
        }
        switch (c) {
        case "'":
          this.rawArguments.push(currentArgument.value)
          currentArgument = {
            case: "unknown",
            value: "",
          }
          return

        default:
          currentArgument.value += c
          return
        }

      case "keyword":
        switch (c) {
        case "'":
          if (currentArgument.value.length <= 0) {
            currentArgument.isInQuotation = true
            return
          }
          this.rawKeywordArguments.set(currentArgument.key, currentArgument.value)
          currentArgument = {
            case: "unknown",
            value: "",
          }
          return

        case " ":
          if (currentArgument.isInQuotation) {
            currentArgument.value += c
          } else {
            this.rawKeywordArguments.set(currentArgument.key, currentArgument.value)
            currentArgument = {
              case: "unknown",
              value: "",
            }
          }
          return

        default:
          currentArgument.value += c
          return
        }

      case "option":
        switch (c) {
        case " ":
          optionArguments.push(...currentArgument.values)
          currentArgument = {
            case: "unknown",
            value: "",
          }
          return

        default:
          currentArgument.values.push(c)
          return
        }

      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = currentArgument
        return
      }
      }
    })

    switch (currentArgument.case) {
    case "unknown":
      if (currentArgument.value.length > 0) {
        this.rawArguments.push(currentArgument.value)
      }
      break
    case "list":
      if (currentArgument.value.length > 0) {
        this.rawArguments.push(currentArgument.value)
      }
      break
    case "keyword":
      this.rawKeywordArguments.set(currentArgument.key, currentArgument.value)
      break
    case "option":
      optionArguments.push(...currentArgument.values)
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = currentArgument
      break
    }
    }

    this.optionArguments = new Set<string>(optionArguments)
    this.optionArguments.delete("-")
  }

  public moveOffset(offset: number): void { // ArgumentParser を別関数に渡すなどの場合の用途
    this.rawArgumentOffset += offset
  }

  public negativeOffsetElements(): string[] { /// offset より前の配列引数
    return this.rawArguments.slice(0, this.rawArgumentOffset)
  }

  protected getRawValueFor(key: ArgumentKey): string | null {
    if (typeof key === "string") {
      return this.rawKeywordArguments.get(key) ?? null
    }
    return this.rawArguments[key[0] + this.rawArgumentOffset] ?? null
  }


  // ---- Value Check ---- //
  public hasAnyKeywordArgumentsOf(keys: string[]): boolean {
    return keys.some(key => this.rawKeywordArguments.has(key) === true)
  }

  public hasListArgumentsOf(index: number): boolean {
    return this.rawArguments.length > (this.rawArgumentOffset + index)
  }


  // ---- Option Arguments ---- //
  public options(): string[] {
    return Array.from(this.optionArguments)
  }

  public hasOption(option: string): boolean {
    return this.optionArguments.has(option)
  }


  // ---- Primitive Type ---- //
  public int(key: ArgumentKey, options?: ArgumentParserOptions): IntArgument {
    return new IntArgument(key, this.getRawValueFor(key), options)
  }

  public float(key: ArgumentKey, options?: ArgumentParserOptions): FloatArgument {
    return new FloatArgument(key, this.getRawValueFor(key), options)
  }

  public bool(key: ArgumentKey, options?: ArgumentParserOptions): BoolArgument {
    return new BoolArgument(key, this.getRawValueFor(key), options)
  }

  public string(key: ArgumentKey, options?: ArgumentParserOptions): StringArgument {
    return new StringArgument(key, this.getRawValueFor(key), options)
  }

  public localPosition(key: ArgumentKey, options?: ArgumentParserOptions): LocalPositionArgument {
    return new LocalPositionArgument(key, this.getRawValueFor(key), options)
  }

  public range(key: ArgumentKey, options?: ArgumentParserOptions): RangeArgument {
    return new RangeArgument(key, this.getRawValueFor(key), options)
  }


  // ---- Typed String ---- //
  public typedString<T extends string>(key: ArgumentKey, typeName: string, typeGuard: ((arg: string) => arg is T), options?: ArgumentParserOptions & { choices?: Readonly<T[]> }): TypedStringArgument<T> {
    return new TypedStringArgument(key, this.getRawValueFor(key), typeName, typeGuard, options?.choices ?? null, options)
  }


  // ---- List ---- //
  public list<T extends IterableArgumentType>(key: ArgumentKey, argumentType: T, options?: ArgumentParserOptions): ListArgumentParser<T> {
    return new ListArgumentParser(key, this.getRawValueFor(key), argumentType, options)
  }


  // ---- Game Object ---- //
  public roomObjectId(key: ArgumentKey, options?: ArgumentParserOptions): RoomObjectIdArgument {
    return new RoomObjectIdArgument(key, this.getRawValueFor(key), options)
  }

  public roomObject(key: ArgumentKey, options?: ArgumentParserOptions): RoomObjectArgument {
    return new RoomObjectArgument(key, this.getRawValueFor(key), options)
  }

  public room(key: ArgumentKey, options?: ArgumentParserOptions): RoomArgument {
    return new RoomArgument(key, this.getRawValueFor(key), options)
  }

  public myRoom(key: ArgumentKey, options?: ArgumentParserOptions): MyRoomArgument {
    return new MyRoomArgument(key, this.getRawValueFor(key), options)
  }

  public roomName(key: ArgumentKey, options?: ArgumentParserOptions): RoomNameArgument {
    return new RoomNameArgument(key, this.getRawValueFor(key), options)
  }

  public myCreep(key: ArgumentKey, options?: ArgumentParserOptions): MyCreepArgument {
    return new MyCreepArgument(key, this.getRawValueFor(key), options)
  }

  public hostileCreep(key: ArgumentKey, options?: ArgumentParserOptions): HostileCreepArgument {
    return new HostileCreepArgument(key, this.getRawValueFor(key), options)
  }

  public creepBody(key: ArgumentKey, options?: ArgumentParserOptions): CreepBodyArgument {
    return new CreepBodyArgument(key, this.getRawValueFor(key), options)
  }
}

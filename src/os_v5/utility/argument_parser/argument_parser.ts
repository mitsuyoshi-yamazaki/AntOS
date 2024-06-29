import { ArgumentKey, ArgumentParserOptions } from "./single_argument_parser"
import { CreepBodyArgument, HostileCreepArgument, IntArgument, LocalPositionArgument, MyCreepArgument, RoomNameArgument, StringArgument, TypedStringArgument } from "./single_argument_parsers"
import { IterableArgumentType, ListArgumentParser } from "./list_argument_parser"

/**
# ArgumentParser
## 要件
- 配列引数とキーワード引数をパースする

## 仕様
- スペースで区切られた引数のうち、keyとvalueが=で紐づけられているものがキーワード引数
- 配列引数は添字で指定するため、キーワード引数より前に指定する
 */

export class ArgumentParser {
  public get isEmpty(): boolean {
    return Array.from(this.rawKeywordArguments.values()).length === 0 && this.rawArguments.length <= this.rawArgumentOffset
  }

  protected rawArgumentOffset = 0
  protected readonly rawArguments: string[] = []
  protected readonly rawKeywordArguments = new Map<string, string>()

  /** @throws */
  public constructor(
    args: string[],
  ) {
    let hasKeywordArguments = false
    const errors: string[] = []

    args.forEach(arg => {
      if (arg.length <= 0) {
        return
      }

      const keyValuePair = arg.split("=")
      switch (keyValuePair.length) {
      case 1:
        // list argument
        if (hasKeywordArguments === true) {
          errors.push(`list argument comes after keyword arguments (${arg})`)
          break
        }
        this.rawArguments.push(arg)
        break

      case 2:
        // keyword argument
        hasKeywordArguments = true
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.rawKeywordArguments.set(keyValuePair[0]!, keyValuePair[1]!)
        break

      default:
        errors.push(`cannot parse argument with ${keyValuePair.length - 1} "="s (${arg})`)
        break
      }
    })

    if (errors.length > 0) {
      throw `Argument parse errors: ${errors.join("\n")}`
    }
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


  // ---- Primitive Type ---- //
  public int(key: ArgumentKey, options?: ArgumentParserOptions): IntArgument {
    return new IntArgument(key, this.getRawValueFor(key), options)
  }

  public string(key: ArgumentKey, options?: ArgumentParserOptions): StringArgument {
    return new StringArgument(key, this.getRawValueFor(key), options)
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
  public roomName(key: ArgumentKey, options?: ArgumentParserOptions): RoomNameArgument {
    return new RoomNameArgument(key, this.getRawValueFor(key), options)
  }

  public localPosition(key: ArgumentKey, options?: ArgumentParserOptions): LocalPositionArgument {
    return new LocalPositionArgument(key, this.getRawValueFor(key), options)
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

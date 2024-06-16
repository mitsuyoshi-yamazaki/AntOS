import { ArgumentKey, ArgumentParserOptions, IntArgument, RoomNameArgument } from "./string_argument_parsers"

/**
# ArgumentParser
## 要件
- 配列引数とキーワード引数を

## 仕様
- スペースで区切られた引数のうち、keyとvalueが=で紐づけられているものがキーワード引数
- 配列引数は添字で指定するため、キーワード引数より前に指定する
 */

export class ArgumentParser {
  private readonly rawArguments: string[] = []
  private readonly rawKeywordArguments = new Map<string, string>()

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

  private getRawValueFor(key: ArgumentKey): string | null {
    if (typeof key === "string") {
      return this.rawKeywordArguments.get(key) ?? null
    }
    return this.rawArguments[key] ?? null
  }


  // ---- Primitive Type ---- //
  public int(key: ArgumentKey, options?: ArgumentParserOptions): IntArgument {
    return new IntArgument(key, this.getRawValueFor(key), options)
  }

  // ---- Game Object ---- //
  public roomName(key: ArgumentKey, options?: ArgumentParserOptions): RoomNameArgument {
    return new RoomNameArgument(key, this.getRawValueFor(key), options)
  }
}

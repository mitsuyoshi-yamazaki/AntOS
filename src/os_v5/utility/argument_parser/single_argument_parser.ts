export type ArgumentKey = string | [number, string | null] /// [index, description]
type Key = ArgumentKey

export type ArgumentParserOptions = {
  readonly missingArgumentErrorMessage?: string
}


abstract class SingleArgumentParser<Options, Value> { // 運用上は常に SingleOptionalArgument を利用するのでexportしない
  public constructor(
    public readonly key: Key,
    public readonly value: string | null,
    protected readonly parseOptions?: ArgumentParserOptions,
  ) {
  }

  /** throws */
  public abstract parse(options?: Options): Value

  protected missingArgumentErrorMessage(): string {
    if (this.parseOptions?.missingArgumentErrorMessage != null) {
      return this.parseOptions.missingArgumentErrorMessage
    }
    return `Missing ${getKeyDescription(this.key)} argument`
  }
}


export abstract class SingleOptionalArgument<Options, Value> extends SingleArgumentParser<Options, Value> {
  /** throws */
  public abstract parse(options?: Options): Value

  /** throws */
  public parseOptional(options?: Options): Value | null {
    if (this.value == null) {
      return null
    }
    return this.parse(options)
  }

  public withStringLiteral<T extends string>(typeGuard: ((arg: string) => arg is T)): SingleOptionalArgument<Options, Value | T> {
    return new UnionArgument<Options, Value, T>(
      (options?: Options): Value => this.parse(options),
      typeGuard,
      this.key,
      this.value,
      this.parseOptions,
    )
  }
}


class UnionArgument<Options, Value, Literal extends string> extends SingleOptionalArgument<Options, Value | Literal> {
  public constructor(
    private readonly parseValue: (options?: Options) => Value,
    private readonly typeGuard: ((arg: string) => arg is Literal),
    key: Key,
    value: string | null,
    parseOptions?: ArgumentParserOptions,
  ) {
    super(key, value, parseOptions)
  }

  public parse(options?: Options): Value | Literal {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    if (this.typeGuard(this.value)) {
      return this.value
    }
    return this.parseValue(options)
  }
}


export const getKeyDescription = (key: ArgumentKey): string => {
  if (typeof key === "string") {
    return key
  }
  const [index, description] = key
  const indexName = ((): string => {
    switch (index % 10) {
    case 1:
      return "st"
    case 2:
      return "nd"
    case 3:
      return "rd"
    default:
      return "th"
    }
  })()

  if (description == null) {
    return `${index}${indexName}`
  }
  return `${description} (${index}${indexName})`
}

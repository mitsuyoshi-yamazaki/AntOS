import { ParameterType } from "shared/utility/types"
import { ArgumentKey, ArgumentParserOptions, SingleOptionalArgument } from "../argument_parser/single_argument_parser"
import { ProcessArgument, V5CreepArgument, V5SpawnedCreepArgument } from "./single_argument_parsers"
import { iterableTypeParserMakers as primitiveIterableTypeParserMakers } from "../argument_parser/list_argument_parser"


const iterableTypeParserMakers = {
  ...primitiveIterableTypeParserMakers,
  process: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): ProcessArgument => {
    return new ProcessArgument(key, value, parseOptions)
  },
  v5_creep: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): V5CreepArgument => {
    return new V5CreepArgument(key, value, parseOptions)
  },
  v5_spawned_creep: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): V5SpawnedCreepArgument => {
    return new V5SpawnedCreepArgument(key, value, parseOptions)
  },
} as const

export type IterableArgumentType = keyof typeof iterableTypeParserMakers
type IterableArgumentParserType<T extends IterableArgumentType> = ReturnType<(typeof iterableTypeParserMakers)[T]>
type IterableArgumentOption<T extends IterableArgumentType> = ParameterType<IterableArgumentParserType<T>["parse"]>
export type IterableArgumentReturnType<T extends IterableArgumentType> = ReturnType<IterableArgumentParserType<T>["parse"]>


export class ListArgumentParser<T extends IterableArgumentType> extends SingleOptionalArgument<IterableArgumentOption<T>, Array<IterableArgumentReturnType<T>>> {
  public constructor(
    key: ArgumentKey,
    value: string | null,
    public readonly argumentType: T,
    parseOptions?: ArgumentParserOptions,
  ) {
    super(key, value, parseOptions)
  }

  /** throws */
  public parse(options?: IterableArgumentOption<T>): Array<IterableArgumentReturnType<T>> {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const separator = ((): string => {
      switch (this.argumentType) {
      case "local_position":
        return ";"
      default:
        return ","
      }
    })()

    const components = this.value.split(separator)
    const results: Array<IterableArgumentReturnType<T>> = []
    const errors: string[] = []

    components.forEach(component => {
      try {
        const parserMaker = iterableTypeParserMakers[this.argumentType]
        const parser = parserMaker(this.key, component, this.parseOptions) as IterableArgumentParserType<T>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const parseResult = parser.parse(options as any) // IterableArgumentOption<T> の T は argumentType の T と独立して解決されるので、 T が UnionType であるときに特定の型を引数に取る parse() 引数に入れられないため
        results.push(parseResult as IterableArgumentReturnType<T>)

      } catch (error) {
        errors.push(`${error}`)
      }
    })

    if (errors.length > 0) {
      throw errors.join("\n")
    }
    return results
  }
}

import { NotUnion } from "shared/utility/types"
import { ArgumentKey, ArgumentParserOptions, SingleOptionalArgument } from "./single_argument_parser"
import { IntArgument, StringArgument } from "./single_argument_parsers"

// const iterableTypeParsers = {
//   int: IntArgument,
//   string: StringArgument,
// } as const

const iterableTypeParserMakers = {
  string: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): StringArgument => {
    return new StringArgument(key, value, parseOptions)
  },
  int: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): IntArgument => {
    return new IntArgument(key, value, options)
  },
  // float: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): FloatArgument => {
  //   return new FloatArgument(key, value, options)
  // },
  // boolean: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): BooleanArgument => {
  //   return new BooleanArgument(key, value, options)
  // },
  // resource: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): TypedStringArgument<ResourceConstant> => {
  //   return new TypedStringArgument(key, value, "ResourceConstant", isResourceConstant, options)
  // },
  // mineral_boost: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): TypedStringArgument<MineralBoostConstant> => {
  //   return new TypedStringArgument(key, value, "MineralBoostConstant", isMineralBoostConstant, options)
  // },
  // deposit: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): TypedStringArgument<DepositConstant> => {
  //   return new TypedStringArgument(key, value, "DepositConstant", isDepositConstant, options)
  // },
  // commodity: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): TypedStringArgument<CommodityConstant> => {
  //   return new TypedStringArgument(key, value, "CommodityConstant", isCommodityConstant, options)
  // },
  // object_id: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): RawStringArgument => {
  //   return new RawStringArgument(key, value, parseOptions)
  // },
  // room_name: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): RoomNameArgument => {
  //   return new RoomNameArgument(key, value, parseOptions)
  // },
  // room: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): RoomArgument => {
  //   return new RoomArgument(key, value, parseOptions)
  // },
  // local_position: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): LocalPositionArgument => {
  //   return new LocalPositionArgument(key, value, parseOptions)
  // },
} as const

// type IterableTypeParsers = typeof iterableTypeParsers
export type IterableArgumentType = keyof typeof iterableTypeParserMakers
// type IterableArgumentParserType = IterableTypeParsers[IterableArgumentType]

type ParameterType<T> = T extends (arg: infer P) => any ? P : never
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

  // public static create<S extends IterableArgumentType>(
  //   key: string,
  //   value: string | null,
  //   argumentType: S,
  //   parseOptions?: ArgumentParserOptions,
  // ): IterableArgument<S> {
  //   const parserMaker = SingularParsers[argumentType] as (key: string, value: string, parseOptions?: ArgumentParserOptions) => SingleOptionalArgument<IterableArgumentOption<S>, IterableArgumentReturnType<S>>
  //   return new IterableArgument(key, value, parserMaker, parseOptions)
  // }

  /** throws */
  public parse(options?: IterableArgumentOption<NotUnion<T>>): Array<IterableArgumentReturnType<T>> {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const components = this.value.split(",")
    const results: Array<IterableArgumentReturnType<T>> = []
    const errors: string[] = []

    components.forEach(component => {
      try {
        const parserMaker = iterableTypeParserMakers[this.argumentType]
        const parser = parserMaker(this.key, component, this.parseOptions) as IterableArgumentParserType<T>
        const parseResult = parser.parse(options as any) //
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


// export type IterableArgumentType = "string"
//   | "int"
//   | "float"
//   | "boolean"
//   | "resource"
//   | "mineral_boost"
//   | "deposit"
//   | "commodity"
//   | "object_id"
//   | "room_name"
//   | "room"
//   | "visible_room_object"
//   | "local_position"

// type IterableArgumentOption<T extends IterableArgumentType> = T extends "string" ? { allowSpacing?: boolean }
//   : T extends "int" ? { min?: number, max?: number }
//   : T extends "float" ? { min?: number, max?: number }
//   : T extends "resource" ? void
//   : T extends "mineral_boost" ? void
//   : T extends "deposit" ? void
//   : T extends "commodity" ? void
//   : T extends "object_id" ? void
//   : T extends "room_name" ? { my?: boolean, allowClosedRoom?: boolean }
//   : T extends "room" ? { my?: boolean, allowClosedRoom?: boolean }
//   : T extends "visible_room_object" ? { inRoomName?: RoomName }
//   : T extends "local_position" ? void
//   : void  // "boolean"

// type IterableArgumentReturnType<T extends IterableArgumentType> = T extends "string" ? string
//   : T extends "int" ? number
//   : T extends "float" ? number
//   : T extends "resource" ? ResourceConstant
//   : T extends "mineral_boost" ? MineralBoostConstant
//   : T extends "deposit" ? DepositConstant
//   : T extends "commodity" ? CommodityConstant
//   : T extends "object_id" ? string
//   : T extends "room_name" ? RoomName
//   : T extends "room" ? Room
//   : T extends "visible_room_object" ? RoomObject
//   : T extends "local_position" ? Position
//   : boolean // "boolean"



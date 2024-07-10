import { ParameterType } from "shared/utility/types"
import { ArgumentKey, ArgumentParserOptions, SingleOptionalArgument } from "./single_argument_parser"
import { CreepBodyArgument, FloatArgument, HostileCreepArgument, IntArgument, LocalPositionArgument, MyCreepArgument, MyRoomArgument, RangeArgument, RoomArgument, RoomNameArgument, RoomObjectArgument, RoomObjectIdArgument, StringArgument } from "./single_argument_parsers"


export const iterableTypeParserMakers = {
  int: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): IntArgument => {
    return new IntArgument(key, value, options)
  },
  float: (key: ArgumentKey, value: string, options?: ArgumentParserOptions): FloatArgument => {
    return new FloatArgument(key, value, options)
  },
  string: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): StringArgument => {
    return new StringArgument(key, value, parseOptions)
  },
  range: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): RangeArgument => {
    return new RangeArgument(key, value, parseOptions)
  },
  local_position: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): LocalPositionArgument => {
    return new LocalPositionArgument(key, value, parseOptions)
  },
  room_object_id: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): RoomObjectIdArgument => {
    return new RoomObjectIdArgument(key, value, parseOptions)
  },
  room_object: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): RoomObjectArgument => {
    return new RoomObjectArgument(key, value, parseOptions)
  },
  room: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): RoomArgument => {
    return new RoomArgument(key, value, parseOptions)
  },
  my_room: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): MyRoomArgument => {
    return new MyRoomArgument(key, value, parseOptions)
  },
  room_name: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): RoomNameArgument => {
    return new RoomNameArgument(key, value, parseOptions)
  },
  my_creep: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): MyCreepArgument => {
    return new MyCreepArgument(key, value, parseOptions)
  },
  hostile_creep: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): HostileCreepArgument => {
    return new HostileCreepArgument(key, value, parseOptions)
  },
  creep_body: (key: ArgumentKey, value: string, parseOptions?: ArgumentParserOptions): CreepBodyArgument => {
    return new CreepBodyArgument(key, value, parseOptions)
  },
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

    const components = this.value.split(",")
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

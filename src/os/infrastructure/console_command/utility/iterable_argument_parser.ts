import { isCommodityConstant, isDepositConstant, isMineralBoostConstant, isResourceConstant } from "utility/resource"
import { RoomName } from "utility/room_name"
import { ArgumentParsingOptions, BooleanArgument, FloatArgument, IntArgument, RoomNameArgument, SingleOptionalArgument, StringArgument, TypedStringArgument } from "./argument_parser"

export type IterableArgumentType = "string" | "int" | "float" | "boolean" | "resource" | "mineral_boost" | "deposit" | "commodity" | "object_id" | "room_name"

type IterableArgumentOption<T extends IterableArgumentType> = T extends "string" ? void
  : T extends "int" ? { min?: number, max?: number }
  : T extends "float" ? { min?: number, max?: number }
  : T extends "resource" ? void
  : T extends "mineral_boost" ? void
  : T extends "deposit" ? void
  : T extends "commodity" ? void
  : T extends "object_id" ? void
  : T extends "room_name" ? { my?: boolean, allowClosedRoom?: boolean }
  : void  // "boolean"

type IterableArgumentReturnType<T extends IterableArgumentType> = T extends "string" ? string
  : T extends "int" ? number
  : T extends "float" ? number
  : T extends "resource" ? ResourceConstant
  : T extends "mineral_boost" ? MineralBoostConstant
  : T extends "deposit" ? DepositConstant
  : T extends "commodity" ? CommodityConstant
  : T extends "object_id" ? string
  : T extends "room_name" ? RoomName
  : boolean // "boolean"

const SingularParsers: { [T in IterableArgumentType]: (key: string, value: string, parseOptions?: ArgumentParsingOptions) => SingleOptionalArgument<IterableArgumentOption<T>, IterableArgumentReturnType<T>> } = {
  string: (key: string, value: string, parseOptions?: ArgumentParsingOptions): StringArgument => {
    return new StringArgument(key, value, parseOptions)
  },
  int: (key: string, value: string, options?: ArgumentParsingOptions): IntArgument => {
    return new IntArgument(key, value, options)
  },
  float: (key: string, value: string, options?: ArgumentParsingOptions): FloatArgument => {
    return new FloatArgument(key, value, options)
  },
  boolean: (key: string, value: string, options?: ArgumentParsingOptions): BooleanArgument => {
    return new BooleanArgument(key, value, options)
  },
  resource: (key: string, value: string, options?: ArgumentParsingOptions): TypedStringArgument<ResourceConstant> => {
    return new TypedStringArgument(key, value, "ResourceConstant", isResourceConstant, options)
  },
  mineral_boost: (key: string, value: string, options?: ArgumentParsingOptions): TypedStringArgument<MineralBoostConstant> => {
    return new TypedStringArgument(key, value, "MineralBoostConstant", isMineralBoostConstant, options)
  },
  deposit: (key: string, value: string, options?: ArgumentParsingOptions): TypedStringArgument<DepositConstant> => {
    return new TypedStringArgument(key, value, "DepositConstant", isDepositConstant, options)
  },
  commodity: (key: string, value: string, options?: ArgumentParsingOptions): TypedStringArgument<CommodityConstant> => {
    return new TypedStringArgument(key, value, "CommodityConstant", isCommodityConstant, options)
  },
  object_id: (key: string, value: string, parseOptions?: ArgumentParsingOptions): StringArgument => {
    return new StringArgument(key, value, parseOptions)
  },
  room_name: (key: string, value: string, parseOptions?: ArgumentParsingOptions): RoomNameArgument => {
    return new RoomNameArgument(key, value, parseOptions)
  },
}

export class IterableArgument<T extends IterableArgumentType> extends SingleOptionalArgument<IterableArgumentOption<T>, Array<IterableArgumentReturnType<T>>> {
  public constructor(
    key: string,
    value: string | null,
    private readonly argumentParserMaker: (key: string, value: string, parseOptions?: ArgumentParsingOptions) => SingleOptionalArgument<IterableArgumentOption<T>, IterableArgumentReturnType<T>>,
    parseOptions?: ArgumentParsingOptions,
  ) {
    super(key, value, parseOptions)
  }

  public static create<S extends IterableArgumentType>(
    key: string,
    value: string | null,
    argumentType: S,
    parseOptions?: ArgumentParsingOptions,
  ): IterableArgument<S> {
    const parserMaker = SingularParsers[argumentType] as (key: string, value: string, parseOptions?: ArgumentParsingOptions) => SingleOptionalArgument<IterableArgumentOption<S>, IterableArgumentReturnType<S>>
    return new IterableArgument(key, value, parserMaker, parseOptions)
  }

  /** throws */
  public parse(options?: IterableArgumentOption<T>): Array<IterableArgumentReturnType<T>> {
    if (this.value == null) {
      throw this.missingArgumentErrorMessage()
    }

    const components = this.value.split(",")
    return components.map(component => {
      const parser = this.argumentParserMaker(this.key, component, this.parseOptions)
      return parser.parse(options)
    })
  }
}

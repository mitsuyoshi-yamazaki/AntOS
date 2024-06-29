import { ArgumentParser as PrimitiveArgumentParser } from "../argument_parser/argument_parser"
import { ArgumentKey, ArgumentParserOptions } from "../argument_parser/single_argument_parser"
import { ProcessArgument, V5CreepArgument } from "./single_argument_parsers"
import { IterableArgumentType, ListArgumentParser } from "./list_argument_parser"

export class ArgumentParser extends PrimitiveArgumentParser {

  // ---- Process ---- //
  public process(key: ArgumentKey, options?: ArgumentParserOptions): ProcessArgument {
    return new ProcessArgument(key, this.getRawValueFor(key), options)
  }

  // ---- List ---- //
  public list<T extends IterableArgumentType>(key: ArgumentKey, argumentType: T, options?: ArgumentParserOptions): ListArgumentParser<T> {
    return new ListArgumentParser(key, this.getRawValueFor(key), argumentType, options)
  }

  // ---- Game Object ---- //
  public v5Creep(key: ArgumentKey, options?: ArgumentParserOptions): V5CreepArgument {
    return new V5CreepArgument(key, this.getRawValueFor(key), options)
  }
}

import { ArgumentParser as PrimitiveArgumentParser } from "../argument_parser/argument_parser"
import { ArgumentKey, ArgumentParserOptions } from "../argument_parser/single_argument_parser"
import { ProcessArgument } from "./single_argument_parsers"

export class ArgumentParser extends PrimitiveArgumentParser {

  // ---- Process ---- //
  public process(key: ArgumentKey, options?: ArgumentParserOptions): ProcessArgument {
    return new ProcessArgument(key, this.getRawValueFor(key), options)
  }
}

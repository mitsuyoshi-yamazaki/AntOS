import { KeywordArguments } from "./keyword_argument_parser"
import { ListArguments } from "./list_argument_parser"

export class ArgumentParser {
  public readonly keyword: KeywordArguments
  public readonly list: ListArguments

  public constructor(args: string[]) {
    this.keyword = new KeywordArguments(args)
    this.list = new ListArguments(args)
  }
}

import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { StandardInputCommand } from "../standard_input_command"

export class ProcessCommand implements StandardInputCommand {
  public readonly command = "process"

  public constructor(
  ) { }

  /** @throws */
  public run(args: string[]): string {
    const listArguments = new ListArguments(args)
    if (listArguments.has(0) !== true) {
      return this.listProcesses()
    }

    return "not implemented yet"
  }

  private listProcesses(): string {
    return "not implemented yet"
  }
}

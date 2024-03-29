import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { ProcessManager } from "v8/operating_system/process_manager"
import { StandardInputCommand } from "../standard_input_command"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

export class KillCommand implements StandardInputCommand {
  public readonly description = [
    "# kill command",
    "- &ltprocess ID&gt"
  ].join("\n")

  public constructor(
  ) { }

  public run(args: string[]): string {
    try {
      const listArguments = new ListArguments(args)
      const processId = listArguments.string(0, "process ID").parse()
      if (ProcessManager.processInfoOf(processId) == null) {
        throw `no process with ID ${processId}`
      }
      ProcessManager.removeProcess(processId)
      return "ok"

    } catch (error) {
      return `${ConsoleUtility.colored("[Error]", "error")} ${error}`
    }
  }
}

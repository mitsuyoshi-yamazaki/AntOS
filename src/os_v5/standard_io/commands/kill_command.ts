import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { controlProcessResult } from "./utilities"


export const KillCommand: Command = {
  command: "kill",

  help(): string {
    return "> kill {process IDs}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const processes = argumentParser.list([0, "process IDs"], "process").parse()
    return "Kill processes:\n" + controlProcessResult(processes, process => {
      ProcessManager.killProcess(process)
      return "killed"
    })
  },
}

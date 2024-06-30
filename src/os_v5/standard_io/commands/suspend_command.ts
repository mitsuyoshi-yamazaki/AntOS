import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { controlProcessResult } from "./utilities"


export const SuspendCommand: Command = {
  command: "suspend",

  help(): string {
    return "suspend {process IDs}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const processes = argumentParser.list([0, "process IDs"], "process").parse()
    return "Suspend processes:\n" + controlProcessResult(processes, process => ProcessManager.suspend(process) === true ? "suspended" : "failed")
  },
}

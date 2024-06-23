import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { controlProcessResult } from "./utilities"


export const ResumeCommand: Command = {
  command: "resume",

  /** @throws */
  help(): string {
    return "> resume {process ID}"
  },

  /** @throws */
  run(args: string[]): string {
    const argumentParser = new ArgumentParser(args)
    if (argumentParser.isEmpty === true) {
      return this.help([])
    }

    const processes = argumentParser.list(0, "process").parse()
    return "Resume processes:\n" + controlProcessResult(processes, process => ProcessManager.suspend(process) === true ? "suspended" : "failed")
  },
}

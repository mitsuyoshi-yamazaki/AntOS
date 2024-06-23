import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { alignedProcessActionResult } from "./utilities"


export const SuspendCommand: Command = {
  command: "suspend",

  /** @throws */
  help(): string {
    return "> suspend {process ID}"
  },

  /** @throws */
  run(args: string[]): string {
    const argumentParser = new ArgumentParser(args)
    if (argumentParser.isEmpty === true) {
      return this.help([])
    }

    const processes = argumentParser.list(0, "process").parse()
    const results = processes
      .map((process): string => {
        const processDescription = ProcessManager.getRuntimeDescription(process) ?? process.staticDescription()
        const result = ProcessManager.suspend(process)
        const resultDescription = result === true ? "suspended" : "failed"
        const state = ProcessManager.getProcessRunningState(process.processId)

        return alignedProcessActionResult(resultDescription, process.processId, process.processType, process.identifier, `${state.isRunning}`, processDescription)
      })

    return [
      "Suspend processes:",
      alignedProcessActionResult("result", "PID", "Type", "Identifier", "Running", "Description [s tatic]"),
      ...results,
    ]
      .join("\n")
  },
}

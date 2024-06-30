import { Command, CommandOutput } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { alignedProcessInfo, processDescription } from "./utilities"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"


export const MessageCommand: Command = {
  command: "message",

  help(): string {
    return "> message {process ID} ...{arguments}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string | CommandOutput[] {
    const process = argumentParser.process([0, "process ID"]).parse()
    argumentParser.moveOffset(+1)

    const output: CommandOutput[] = [
      {
        outputType: "output",
        message: alignedProcessInfo("PID", "Type", "Identifier", "Running", "Description [s tatic]"),
      },
      {
        outputType: "output",
        message: processDescription({ process, ...ProcessManager.getProcessRunningState(process.processId) }),
      },
    ]

    try {
      output.push({
        outputType: "output",
        message: ProcessManager.sendMessage(process, argumentParser)
      })
    } catch (error) {
      output.push({
        outputType: "error",
        message: `${error}`
      })
    }
    return output
  },
}

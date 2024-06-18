import { AnyProcessId } from "os_v5/process/process"
import { Command, CommandOutput } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { processDescription } from "./utilities"


export const MessageCommand: Command = {
  command: "message",

  /** @throws */
  help(): string {
    return "> message {process ID} ...{arguments}"
  },

  /** @throws */
  run(args: string[]): string | CommandOutput[] {
    const processId = args.shift() as AnyProcessId | undefined

    if (processId == null || processId.length <= 0) {
      return this.help([])
    }

    const process = ProcessManager.getProcess(processId)
    if (process == null) {
      throw `No Process with ID ${processId}`
    }

    const output: CommandOutput[] = [{
      outputType: "output",
      message: processDescription({ process, ...ProcessManager.getProcessRunningState(process.processId) }),
    }]

    try {
      output.push({
        outputType: "output",
        message: ProcessManager.sendMessage(process, args)
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

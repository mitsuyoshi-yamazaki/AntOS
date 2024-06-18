import { AnyProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"


export const KillCommand: Command = {
  command: "kill",

  /** @throws */
  help(): string {
    return "> kill {process ID}"
  },

  /** @throws */
  run(args: string[]): string {
    const processId = args.shift() as AnyProcessId | undefined

    if (processId == null || processId.length <= 0) {
      return this.help([])
    }

    const process = ProcessManager.getProcess(processId)
    if (process == null) {
      throw `No Process with ID ${process}`
    }

    const processDescription = ProcessManager.getRuntimeDescription(process)
    ProcessManager.killProcess(process)
    return `Killed ${process.processType} ${processId}: ${processDescription}`
  },
}

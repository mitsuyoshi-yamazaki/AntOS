import { AnyProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"


export const ResumeCommand: Command = {
  command: "resume",

  /** @throws */
  help(): string {
    return "> resume {process ID}"
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
    const result = ProcessManager.resume(process)

    if (result !== true) {
      throw `Cannot resume ${process.processType} ${processId}`
    }

    return `Resumed ${process.processType} ${processId}: ${processDescription}`
  },
}

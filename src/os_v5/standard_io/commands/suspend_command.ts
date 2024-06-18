import { AnyProcessId } from "os_v5/process/process"
import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"


export const SuspendCommand: Command = {
  command: "suspend",

  /** @throws */
  help(): string {
    return "> suspend {process ID}"
  },

  /** @throws */
  run(args: string[]): string {
    const processId = args.shift() as AnyProcessId | undefined

    if (processId == null || processId.length <= 0) {
      return this.help([])
    }

    const process = ProcessManager.getProcess(processId)
    if (process == null) {
      throw `No Process with ID ${processId}`
    }

    const processDescription = ProcessManager.getRuntimeDescription(process)
    const result = ProcessManager.suspend(process)

    if (result !== true) {
      throw `Cannot suspend ${process.processType} ${processId}`
    }

    return `Suspended ${process.processType} ${processId}: ${processDescription}`
  },
}

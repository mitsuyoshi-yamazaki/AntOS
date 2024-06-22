import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"


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

    const process = argumentParser.process(0).parse()

    const processDescription = ProcessManager.getRuntimeDescription(process) ?? process.staticDescription()
    const result = ProcessManager.suspend(process)

    if (result !== true) {
      throw `Cannot suspend ${process.processType} ${process.processId}`
    }

    return `Suspended ${process.processType} ${process.processId}: ${processDescription}`
  },
}

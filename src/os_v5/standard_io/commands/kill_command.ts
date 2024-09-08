import { Command } from "../command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { AlignedProcessInfo, controlProcessResult, processDescription } from "./utilities"
import { AnyProcess } from "os_v5/process/process"


export const KillCommand: Command = {
  command: "kill",

  help(): string {
    return "kill {process IDs}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const processes = argumentParser.list([0, "process IDs"], "process").parse()
    const dryRun = argumentParser.hasOption("y") !== true

    if (dryRun) {
      return processDescriptionList(processes)
    }

    return "Kill processes:\n" + controlProcessResult(processes, process => {
      ProcessManager.killProcess(process)
      return "killed"
    })
  },
}


const processDescriptionList = (processes: AnyProcess[]): string => {
  const processDescriptions = processes.map(process => {
    return processDescription({
      process,
      ...ProcessManager.getProcessRunningState(process.processId),
    })
  })

  const results: string[] = [
    "Kill following processes (to proceed, add \"-y\")",
    AlignedProcessInfo.header("PID", "Type", "Identifier", "Running", "Description [s tatic]"),
    ...processDescriptions,
  ]

  return results.join("\n")
}

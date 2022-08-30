import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { tab, Tab } from "utility/log"
import { ProcessManager } from "v8/operating_system/process_manager"
import { ProcessInfo } from "v8/operating_system/process_store"
import { StandardInputCommand } from "../standard_input_command"

export class ProcessCommand implements StandardInputCommand {
  public readonly description = [
    "# show process info",
    "- list all processes:",
    "  (no parameters)",
    "- show process detail:",
    "  &ltprocess ID&gt",
  ].join("\n")

  public constructor(
  ) { }

  /** @throws */
  public run(args: string[]): string {
    const listArguments = new ListArguments(args)
    if (listArguments.has(0) !== true) {
      return this.listProcesses()
    }

    return "not implemented yet"
  }

  private listProcesses(): string {
    const processes = ProcessManager.listProcesses()

    const getAlignedText = (processId: string, typeIdentifier: string, runningState: string, description: string): string => {
      return `${tab(processId, Tab.small)}${tab(typeIdentifier, Tab.large)}${tab(runningState, Tab.small)}${tab(description, Tab.medium)}`
    }

    const getDescription = (processInfo: ProcessInfo): string => {
      const process = processInfo.process
      if (process.shortDescription != null) {
        return process.shortDescription()
      }
      return ""
    }

    const results: string[] = [
      getAlignedText("PID", "Type", "Running", "Description"),
      ...processes
        .map(processInfo => getAlignedText(processInfo.process.processId, processInfo.process.processType, `${processInfo.running}`, getDescription(processInfo)))
    ]
    return results.join("\n")
  }
}

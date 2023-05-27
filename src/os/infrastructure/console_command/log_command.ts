import { ProcessId } from "process/process"
import { parseProcessId } from "../../../shared/utility/argument_parser/command_utility"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { coloredText } from "utility/log"
import { ProcessCommandRunner } from "./process_command"

export class LogCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    const commandList = ["help", "add", "remove", "clear", "show"]
    const args = [...this.args]
    const command = args.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "add":
      case "remove": {
        const parseResult = parseProcessId(args[0])
        switch (parseResult.resultType) {
        case "succeeded":
          return this.changeFilterSetting(command, parseResult.value)
        case "failed":
          return `${parseResult.reason}`
        }
      }

      // eslint-disable-next-line no-fallthrough
      case "clear":
        this.clearFilter()
        return "Log filter cleared"

      case "show":
        return this.showProcesses()

      default:
        throw `Invalid command ${command}. Available commands are: ${commandList}`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  private clearFilter(): void {
    Memory.os.logger.filteringProcessIds.splice(0, Memory.os.logger.filteringProcessIds.length)
  }

  private showProcesses(): string {
    const processIds = [...Memory.os.logger.filteringProcessIds]
    const processCommandRunner = new ProcessCommandRunner()
    return processCommandRunner.listProcess(processIds)
  }

  private changeFilterSetting(command: "add" | "remove", processId: ProcessId): CommandExecutionResult {
    switch (command) {
    case "add":
      if (Memory.os.logger.filteringProcessIds.includes(processId) === true) {
        return `Process ID ${processId} already added to the filter list`
      }
      Memory.os.logger.filteringProcessIds.push(processId)
      return `Added ${processId}`

    case "remove": {
      const index = Memory.os.logger.filteringProcessIds.indexOf(processId)
      if (index < 0) {
        return `Process ID ${processId} not in the filter list`
      }
      Memory.os.logger.filteringProcessIds.splice(index, 1)
      return `Removed ${processId}`
    }
    }
  }
}

import { ProcessId } from "process/process"
import { parseProcessId } from "./utility/command_utility"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class LogCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    switch (this.args[0]) {
    case "add":
    case "remove": {
      const parseResult = parseProcessId(this.args[1])
      switch (parseResult.resultType) {
      case "succeeded":
        return this.changeFilterSetting(this.args[0], parseResult.value)
      case "failed":
        return `${parseResult.reason}`
      }
    }

    // eslint-disable-next-line no-fallthrough
    case "clear":
      this.clearFilter()
      return "Log filter cleared"

    default:
      return `Invalid command ${this.args[0]}. Available commands are: [add, remove, clear]`
    }
  }

  private clearFilter(): void {
    Memory.os.logger.filteringProcessIds.splice(0, Memory.os.logger.filteringProcessIds.length)
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

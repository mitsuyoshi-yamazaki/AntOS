import { OperatingSystem } from "os/os"
import { parseProcessId } from "../../../shared/utility/argument_parser/command_utility"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class KillCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    const parseResult = parseProcessId(this.args)
    switch (parseResult.resultType) {
    case "succeeded":
      return this.killProcess(parseResult.value)
    case "failed":
      return `${parseResult.reason}`
    }
  }

  private killProcess(processId: number): CommandExecutionResult {
    const result = OperatingSystem.os.killProcess(processId)
    switch (result.resultType) {
    case "succeeded":
      return `Process ${result.value} killed, ID: ${processId}`
    case "failed":
      return `${result.reason}`
    }
  }
}

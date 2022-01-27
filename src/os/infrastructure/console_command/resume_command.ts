import { OperatingSystem } from "os/os"
import { parseProcessId } from "./utility/command_utility"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class ResumeCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    const parseResult = parseProcessId(this.args)
    switch (parseResult.resultType) {
    case "succeeded":
      return this.resumeProcess(parseResult.value)
    case "failed":
      return `${parseResult.reason}`
    }
  }

  private resumeProcess(processId: number): CommandExecutionResult {
    const result = OperatingSystem.os.resumeProcess(processId)
    switch (result.resultType) {
    case "succeeded":
      return `Process ${result.value} resumed, ID: ${processId}`
    case "failed":
      return `${result.reason}`
    }
  }
}

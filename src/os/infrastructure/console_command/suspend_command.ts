import { OperatingSystem } from "os/os"
import { parseProcessId } from "./command_utility"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class SuspendCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    const parseResult = parseProcessId(this.args)
    switch (parseResult.resultType) {
    case "succeeded":
      return this.suspendProcess(parseResult.value)
    case "failed":
      return `${parseResult.reason}`
    }
  }

  private suspendProcess(processId: number): CommandExecutionResult {
    const result = OperatingSystem.os.suspendProcess(processId)
    switch (result.resultType) {
    case "succeeded":
      return `Process ${result.value} suspended, ID: ${processId}`
    case "failed":
      return `${result.reason}`
    }
  }
}

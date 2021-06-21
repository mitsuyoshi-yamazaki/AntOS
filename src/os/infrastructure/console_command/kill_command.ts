import { OperatingSystem } from "os/os"
import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class KillCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    const parseResult = this.parseProcessId()
    switch (parseResult.resultType) {
    case "succeeded":
      return this.killProcess(parseResult.value)
    case "failed":
      return `${parseResult.error}`
    }
  }

  private parseProcessId(): ResultType<number> {
    if (this.args.length <= 0) {
      return new ResultFailed(new Error("Missing process ID argument"))
    }
    const processId = parseInt(this.args[0], 10)
    if (isNaN(processId)) {
      return new ResultFailed(new Error(`Invalid process ID argument ${this.args[0]}`))
    }
    return new ResultSucceeded(processId)
  }

  private killProcess(processId: number): CommandExecutionResult {
    const result = OperatingSystem.os.killProcess(processId)
    switch (result.resultType) {
    case "succeeded":
      return `Kill process ${result.value}, ID: ${processId}`
    case "failed":
      return `${result.error}`
    }
  }
}

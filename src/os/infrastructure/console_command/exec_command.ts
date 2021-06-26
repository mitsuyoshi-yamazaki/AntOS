import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { findPath } from "script/pathfinder"

export class ExecCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    switch (this.args[0]) {
    case "FindPath":
      return this.findPath()
    default:
      return "Invalid script type"
    }
  }

  private findPath(): CommandExecutionResult {
    return findPath()
  }
}

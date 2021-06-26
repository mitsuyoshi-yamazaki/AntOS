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

  // ---- Parse arguments ---- //
  private parseProcessArguments(): Map<string, string> {
    const args = this.args.concat([])
    args.splice(0, 1)
    const result = new Map<string, string>()
    args.forEach(arg => {
      const components = arg.split("=")
      if (components.length !== 2) {
        return
      }
      result.set(components[0], components[1])
    })
    return result
  }

  private missingArgumentError(argumentName: string): CommandExecutionResult {
    return `Missing ${argumentName} argument`
  }

  // ---- Execute ---- //
  private findPath(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const startObjectId = args.get("start_object_id")
    if (startObjectId == null) {
      return this.missingArgumentError("start_object_id")
    }

    const goalObjectId = args.get("goal_object_id")
    if (goalObjectId == null) {
      return this.missingArgumentError("goal_object_id")
    }

    const rangeString = args.get("range")
    if (rangeString == null) {
      return this.missingArgumentError("range")
    }
    const range = parseInt(rangeString, 10)
    if (isNaN(range) === true) {
      return `Invalid NaN argument range (${range})`
    }

    return findPath(startObjectId, goalObjectId, range)
  }
}

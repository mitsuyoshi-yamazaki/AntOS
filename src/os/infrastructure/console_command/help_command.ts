import { commandDefinitions, ConsoleCommand, CommandExecutionResult } from "./console_command"

export class HelpCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    return commandDefinitions.reduce((result, current) => {
      const options = (): string => {
        if (current.options.length <= 0) {
          return ""
        }
        return current.options.reduce((optionResult, currentOption) => {
          return `${optionResult}\n  - ${currentOption}`
        }, "\n- options:")
      }
      const args = (): string => {
        if (current.args == null) {
          return ""
        }
        return `\n- arguments: ${current.args}`
      }
      return `${result}\n\n# ${current.command}\n${current.description}${options()}${args()}`
    }, "Available commands:")
  }
}

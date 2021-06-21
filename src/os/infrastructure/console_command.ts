const consoleCommandTypes: string[] = [
  "help"
]
type ConsoleCommandType = typeof consoleCommandTypes[number]

export const isConsoleCommand = (obj: string): obj is ConsoleCommandType => {
  return consoleCommandTypes.includes(obj)
}

interface ConsoleCommandDefinition {
  command: ConsoleCommandType
  description: string
  options: string[]
  args: string | null
}

type CommandExecutionResult = string

export interface ConsoleCommand {
  options: Map<string, string>
  args: string[]

  run(): CommandExecutionResult
}

const commandDefinitions: ConsoleCommandDefinition[] = [
  {
    command: "help",
    description: "List available commands.",
    options: [],
    args: null,
  }
]

export class HelpCommand implements ConsoleCommand {
  public readonly options = new Map<string, string>()
  public readonly args: string[] = []

  public constructor() {}

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

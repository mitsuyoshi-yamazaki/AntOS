const consoleCommandTypes: string[] = [
  "help"
]
type ConsoleCommandType = typeof consoleCommandTypes[number]

export const isConsoleCommand = (obj: string): obj is ConsoleCommandType => {
  return consoleCommandTypes.includes(obj)
}

interface ConsoleCommandDefinition {
  command: ConsoleCommandType
  options: string[]
  args: string | null
}

type CommandExecutionResult = string

export interface ConsoleCommand {
  options: Map<string, string>
  args: string[]

  run(): CommandExecutionResult
}

const messageDefinitions: ConsoleCommandDefinition[] = [
  {
    command: "help",
    options: [],
    args: null,
  }
]

export class HelpCommand implements ConsoleCommand {
  public readonly options = new Map<string, string>()
  public readonly args: string[] = []

  public constructor() {}

  public run(): CommandExecutionResult {
    return "You just called help command!" // TODO:
  }
}

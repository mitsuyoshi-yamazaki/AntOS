import { OperatingSystem } from "os/os"
import { ResultFailed, ResultSucceeded, ResultType } from "utility/result"

const consoleCommandTypes = [
  "help",
  "kill",
] as const
type ConsoleCommandType = typeof consoleCommandTypes[number]

export const isConsoleCommand = (obj: string): obj is ConsoleCommandType => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return consoleCommandTypes.includes(obj as any)
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
  rawCommand: string

  run(): CommandExecutionResult
}

const commandDefinitions: ConsoleCommandDefinition[] = [
  {
    command: "help",
    description: "List available commands.",
    options: [],
    args: null,
  },
  {
    command: "kill",
    description: "Terminate specified process",
    options: [],
    args: "Process ID",
  }
]

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

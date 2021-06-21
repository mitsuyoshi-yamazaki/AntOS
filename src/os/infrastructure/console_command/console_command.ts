const consoleCommandTypes = [
  "help",
  "kill",
  "launch",
  "process",
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

export type CommandExecutionResult = string

export interface ConsoleCommand {
  options: Map<string, string>
  args: string[]
  rawCommand: string

  run(): CommandExecutionResult
}

export const commandDefinitions: ConsoleCommandDefinition[] = [
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
  },
  {
    command: "launch",
    description: "Launch specified process",
    options: [],
    args: "Process type name, process launch options key1=value1 key2=value2 ...",
  },
  {
    command: "process",
    description: "Show running process info",
    options: [
      "-l: List all running processes"
    ],
    args: "Process ID",
  }
]

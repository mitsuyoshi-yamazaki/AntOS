const consoleCommandTypes = [
  "help",
  "kill",
  "suspend",
  "resume",
  "launch",
  "exec",
  "process",
  "message",
  "memory",
  "log",
] as const
export type ConsoleCommandType = typeof consoleCommandTypes[number]

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
    command: "suspend",
    description: "Suspend specified process",
    options: [],
    args: "Process ID",
  },
  {
    command: "resume",
    description: "Resume specified process",
    options: [],
    args: "Process ID",
  },
  {
    command: "launch",
    description: "Launch specified process",
    options: [
      "-l: Add launched process ID to logger filter"
    ],
    args: "Process type name, process launch arguments key1=value1 key2=value2 ...",
  },
  {
    command: "exec",
    description: "Execute specified script",
    options: [],
    args: "Script name, script arguments key1=value1 key2=value2 ...",
  },
  {
    command: "process",
    description: "Show running process info",
    options: [
      "-l: List all running processes"
    ],
    args: "Process ID",
  },
  {
    command: "message",
    description: "Send message to specified process",
    options: [],
    args: "Process ID, message to send"
  },
  {
    command: "memory",
    description: "Edit memory contents",
    options: [],
    args: "Operation type name, arguments key1=value1 key2=value2 ..."
  },
  {
    command: "log",
    description: "Edit log filter",
    options: [],
    args: "Command (add|remove|clear), Process ID"
  },
]

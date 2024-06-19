import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Command } from "./command"

// Commands
import { LaunchCommand } from "./commands/launch_command"
import { ProcessCommand } from "./commands/process_command"
import { KillCommand } from "./commands/kill_command"
import { SuspendCommand } from "./commands/suspend_command"
import { ResumeCommand } from "./commands/resume_command"
import { MessageCommand } from "./commands/message_command"


const commandRunners: Command[] = [
  LaunchCommand,
  ProcessCommand,
  KillCommand,
  SuspendCommand,
  ResumeCommand,
  MessageCommand,
]
const commandMap = new Map<string, Command>(commandRunners.map(command => [command.command, command]))


export const StandardIO = (input: string): string => {
  try {
    const args = input.split(" ")
    const command = args.shift()
    if (command == null || command.length <= 0) {
      throw "No command"
    }

    const commandRunner = commandMap.get(command)

    if (commandRunner != null) {
      return runCommand(commandRunner, args)
    }

    switch (command) {
    case "help":
      return [
        "Available commands are:",
        ...commandRunners.map(runner => `- ${runner.command}`)
      ].join("\n")

    default:
      throw `Unknown command "${command}"`
    }
  } catch (error) {
    return `${ConsoleUtility.colored("[ERROR]", "error")} ${error}`
  }
}

/** @throws */
const runCommand = (command: Command, args: string[]): string => {
  if (args[0] === "help") {
    args.shift()
    return command.help(args)
  }

  const output = command.run(args)
  if (typeof output === "string") {
    return output
  } else {
    const messages: string[] = output.map(line => {
      switch (line.outputType) {
      case "output":
        return line.message
      case "error":
        return `${ConsoleUtility.colored("[ERROR]", "error")} ${line.message}`
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = line.outputType
        return ""
      }
      }
    })
    return messages.join("\n")
  }
}

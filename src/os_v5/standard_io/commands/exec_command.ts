import { Command } from "../command"
import { runCommand } from "../utilities"

// Commands
import { TestCommand } from "./exec_commands/test_command"

const commandRunners: Command[] = [
  TestCommand,
]
const commandMap = new Map<string, Command>(commandRunners.map(command => [command.command, command]))


export const ExecCommand: Command = {
  command: "exec",

  /** @throws */
  help(): string {
    return "> exec {command} {...args}"
  },

  /** @throws */
  run(args: string[]): string {
    const command = args.shift()
    if (command == null || command.length <= 0) {
      throw "No exec command"
    }

    const commandRunner = commandMap.get(command)

    if (commandRunner != null) {
      return runCommand(commandRunner, args)
    }

    switch (command) {
    case "help":
      return [
        "Available exec commands are:",
        ...commandRunners.map(runner => `- ${runner.command}`)
      ].join("\n")

    default:
      throw `Unknown exec command "${command}"`
    }

  },
}

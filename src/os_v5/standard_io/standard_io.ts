import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Command } from "./command"

// Commands
import { LaunchCommand } from "./commands/launch_command"
import { ProcessCommand } from "./commands/process_command"


// TODO: コマンド対応表とhelpコマンドは動的に生成する


export const StandardIO = (input: string): string => {
  try {
    const args = input.split(" ")
    const command = args.shift()

    switch (command) {
    case "help":
      return [
        "Available commands are:",
        "- launch",
      ].join("\n")

    case "launch":
      return runCommand(LaunchCommand, args)

    case "process":
      return runCommand(ProcessCommand, args)

    case null:
    case undefined:
      throw "Command is null"

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
  return command.run(args)
}

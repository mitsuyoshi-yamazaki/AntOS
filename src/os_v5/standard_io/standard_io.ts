import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Command } from "./command"
import { ProcessLauncher } from "./commands/process_launcher"

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
        return runCommand(ProcessLauncher, args)

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

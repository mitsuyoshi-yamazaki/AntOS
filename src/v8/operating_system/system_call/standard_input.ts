import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { StandardInputCommand } from "./standard_input_command"

export const standardInput = (commands: Map<string, StandardInputCommand>): (message?: string) => string => {
  return message => {
    try {
      if (!(typeof message === "string")) {
        throw `invalid argument ${typeof message}`
      }

      const args = message.split(" ")
      const commandType = args.shift()

      if (commandType == null) {
        throw "empty input"
      }

      if (commandType === "help") {
        const commandList = Array.from(commands.keys())
        return `available commands: ${commandList.join(", ")}`
      }

      const command = commands.get(commandType)
      if (command == null) {
        throw `invalid command ${commandType}`
      }
      if (args.join("") === "help") {
        return command.description
      }
      return command.run(args)

    } catch (error) {
      return `${ConsoleUtility.colored("[Error]", "error")} ${error}`
    }
  }
}

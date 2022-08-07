import { coloredText } from "utility/log"
import { StandardInputCommand } from "./standard_input_command"

export const standardInput = (commands: StandardInputCommand[]): (message: string) => string => {
  return message => {
    const args = message.split(" ")
    const commandType = args.shift()

    try {
      if (commandType == null) {
        throw "empty input"
      }

      if (commandType === "help") {
        const commandList = commands.map(command => command.command)
        return `available commands: ${commandList.join(", ")}`
      }

      const command = commands.find(command => command.command === commandType)
      if (command == null) {
        throw `invalid command ${commandType}`
      }
      return command.run(args)

    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }
}

import { coloredText } from "utility/log"
// import { LaunchProcessCommand } from "../../command/launch_process_command"
import { ArgumentParser } from "os/infrastructure/console_command/utility/argument_parser"

const commandList = [
  "help",
  "launch",
] as const
type Command = typeof commandList[number]

function isCommand(arg: string): arg is Command {
  return (commandList as (readonly string[])).includes(arg)
}

export const StandardInput = {
  input(message: string): string {
    const args = message.split(" ")
    const command = args.shift()

    try {
      if (command == null) {
        throw "empty input"
      }
      if (!isCommand(command)) {
        throw `invalid command ${command}. see: "help"`
      }

      switch (command) {
        case "help":
          return `available commands: ${commandList.join(", ")}`

        case "launch":
          return launch(args)
      }

    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  },
}

/** @throws */
function launch(args: string[]): string {
  // const parser = new ArgumentParser(args)
  // const processType = parser.list.string(0, "process type").parse()

  // LaunchProcessCommand.launch(processType, )
  return "not implemented yet"
}

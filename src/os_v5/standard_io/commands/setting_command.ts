// Commands
import { LoggerCommand } from "./setting_commands/logger_command"
import { ProcessCommand } from "./setting_commands/process_manager_command"

// Import
import { Command, runCommands } from "../command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"


const commandRunners: Command[] = [
  LoggerCommand,
  ProcessCommand,
]


export const SettingCommand: Command = {
  command: "setting",

  help(): string {
    return "setting {target} {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, commandRunners)
  },
}

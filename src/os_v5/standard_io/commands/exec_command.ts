import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { Command, runCommands } from "../command"

// Commands
import { TestCommand } from "./exec_commands/test_command"


const commandRunners: Command[] = [
  TestCommand,
]


export const ExecCommand: Command = {
  command: "exec",

  help(): string {
    return "exec {command} {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, commandRunners)
  },
}

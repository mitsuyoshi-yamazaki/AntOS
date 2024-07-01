// ---- Commands ---- //
import { ExecCommand } from "./commands/exec_command"
import { LaunchCommand } from "./commands/launch_command"
import { ProcessCommand } from "./commands/process_command"
import { KillCommand } from "./commands/kill_command"
import { SuspendCommand } from "./commands/suspend_command"
import { ResumeCommand } from "./commands/resume_command"
import { MessageCommand } from "./commands/message_command"
import { LoggerCommand } from "./commands/logger_command"
import { SettingCommand } from "./commands/setting_command"

// ---- ---- //
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Command, runCommands } from "./command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"


const commandRunners: Command[] = [
  ExecCommand,
  LaunchCommand,
  ProcessCommand,
  KillCommand,
  SuspendCommand,
  ResumeCommand,
  MessageCommand,
  LoggerCommand,
  SettingCommand,
]


export const StandardIO = (input: string): string => {
  try {
    const argumentParser = new ArgumentParser(input.split(" "))
    return runCommands(argumentParser, commandRunners)
  } catch (error) {
    return `${ConsoleUtility.colored("[ERROR]", "error")} ${error}`
  }
}

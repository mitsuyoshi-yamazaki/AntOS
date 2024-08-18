// ---- Commands ---- //
import { ExecCommand } from "./commands/exec_command"
import { LaunchCommand } from "./commands/launch_command"
import { ProcessCommand } from "./commands/process_command"
import { KillCommand } from "./commands/kill_command"
import { SuspendCommand } from "./commands/suspend_command"
import { ResumeCommand } from "./commands/resume_command"
import { MessageCommand } from "./commands/message_command"
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
  SettingCommand,
]


export const StandardIO = (input: string): string => {
  try {
    const argumentParser = new ArgumentParser(input)
    return runCommands(argumentParser, commandRunners)
  } catch (error) {
    if (error instanceof Error) {
      const stackTrace = error.stack
      if (stackTrace != null) {
        return `${ConsoleUtility.colored("[ERROR]", "error")} ${error}\n${stackTrace}`
      }
    }
    return `${ConsoleUtility.colored("[ERROR]", "error")} ${error}`
  }
}

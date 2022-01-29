import { ErrorMapper } from "error_mapper/ErrorMapper"
import { Result, ResultFailed } from "utility/result"
import {
  ConsoleCommand,
  isConsoleCommand,
} from "./console_command/console_command"
import { ExecCommand } from "./console_command/exec_command"
import { HelpCommand } from "./console_command/help_command"
import { KillCommand } from "./console_command/kill_command"
import { LaunchCommand } from "./console_command/launch_command"
import { MemoryCommand } from "./console_command/memory_command"
import { MessageCommand } from "./console_command/message_command"
import { ProcessCommand } from "./console_command/process_command"
import { ResumeCommand } from "./console_command/resume_command"
import { SuspendCommand } from "./console_command/suspend_command"
import { LogCommand } from "./console_command/log_command"
import { coloredText } from "utility/log"

export const standardInput = (rawCommand: string): string => {
  const result = ErrorMapper.wrapLoop((): string => {
    const parseResult = parseCommand(rawCommand)
    switch (parseResult.resultType) {
    case "succeeded":
      return parseResult.value.run()

    case "failed":
      return `${coloredText("[ERROR]", "error")} Type Game.io("help") to see available commands.\n${parseResult.reason}`
    }
  })()
  if (result == null) {
    return `${coloredText("[ERROR]", "error")} Program bug`
  }
  return result.replace("<", "&lt").replace(">", "&gt")
}

/**
 * - [ ] "/'で囲われたスペースを許可する
 */
function parseCommand(rawCommand: string): Result<ConsoleCommand, string> {
  const invalidCommandDescription = (description: string): ResultFailed<string> => {
    return Result.Failed(`Parsing command failed: ${description} (raw command: "${rawCommand}")`)
  }

  const components = rawCommand.split(" ")
  if (components.length <= 0) {
    return invalidCommandDescription("Empty Command")
  }

  const command = components[0]
  if (command == null || !isConsoleCommand(command)) {
    return invalidCommandDescription(`Unknown command ${command}`)
  }
  components.splice(0, 1)

  const options = new Map<string, string>()
  const args: string[] = []

  components.forEach(component => {
    if (component.startsWith("-")) {
      const [optionKey, optionValue] = component.split("=")
      if (optionKey != null) {
        options.set(optionKey, optionValue ?? "")
      }
      return
    }
    if (component.length > 0) {
      args.push(component)
    }
  })

  if (options.has("-v")) {
    const optionsDescription = Array.from(options.keys()).reduce((result, key) => {
      return `${result},(${key}=${options.get(key)})`
    }, "")
    const argsDescription = args.join(",")
    console.log(`- command: ${command}\n- options: ${optionsDescription}\n- arguments: ${argsDescription}`)
  }

  switch (command) {
  case "help":
    return Result.Succeeded(new HelpCommand(options, args, rawCommand))

  case "kill":
    return Result.Succeeded(new KillCommand(options, args, rawCommand))

  case "suspend":
    return Result.Succeeded(new SuspendCommand(options, args, rawCommand))

  case "resume":
    return Result.Succeeded(new ResumeCommand(options, args, rawCommand))

  case "launch":
    return Result.Succeeded(new LaunchCommand(options, args, rawCommand))

  case "exec":
    return Result.Succeeded(new ExecCommand(options, args, rawCommand))

  case "process":
    return Result.Succeeded(new ProcessCommand(options, args, rawCommand))

  case "message":
    return Result.Succeeded(new MessageCommand(options, args, rawCommand))

  case "memory":
    return Result.Succeeded(new MemoryCommand(options, args, rawCommand))

  case "log":
    return Result.Succeeded(new LogCommand(options, args, rawCommand))
  }
}

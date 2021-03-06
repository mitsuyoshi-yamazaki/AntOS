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
import { MessageCommand } from "./console_command/message_command"
import { ProcessCommand } from "./console_command/process_command"

export const standardInput = (rawCommand: string): string => {
  let result: string | null = null

  ErrorMapper.wrapLoop((): void => {
    const parseResult = parseCommand(rawCommand)
    switch (parseResult.resultType) {
    case "succeeded":
      result = parseResult.value.run()
      return

    case "failed":
      result = `Type Game.io("help") to see available commands.\n${parseResult.reason}`
      return
    }
  })()
  if (result == null) {
    return "Program bug"
  }
  return result
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
  if (!isConsoleCommand(command)) {
    return invalidCommandDescription(`Unknown command ${command}`)
  }
  components.splice(0, 1)

  const options = new Map<string, string>()
  const args: string[] = []

  components.forEach(component => {
    if (component.startsWith("-")) {
      const optionKeyValue = component.split("=")
      switch (optionKeyValue.length) {
      case 1:
        options.set(optionKeyValue[0], "")
        break
      case 2:
        options.set(optionKeyValue[0], optionKeyValue[1])
        break
      default:
        break
      }
      return
    }
    args.push(component)
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

  case "launch":
    return Result.Succeeded(new LaunchCommand(options, args, rawCommand))

  case "exec":
    return Result.Succeeded(new ExecCommand(options, args, rawCommand))

  case "process":
    return Result.Succeeded(new ProcessCommand(options, args, rawCommand))

  case "message":
    return Result.Succeeded(new MessageCommand(options, args, rawCommand))
  }
}

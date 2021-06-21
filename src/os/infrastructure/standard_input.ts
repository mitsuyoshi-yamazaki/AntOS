import { ResultType, ResultFailed, ResultSucceeded } from "utility/result"
import {
  ConsoleCommand,
  isConsoleCommand,
} from "./console_command/console_command"
import { HelpCommand } from "./console_command/help_command"
import { KillCommand } from "./console_command/kill_command"
import { LaunchCommand } from "./console_command/launch_command"
import { ProcessCommand } from "./console_command/process_command"

export const standardInput = (rawCommand: string): string => {
  const parseResult = parseCommand(rawCommand)
  switch (parseResult.resultType) {
  case "succeeded":
    return parseResult.value.run()

  case "failed":
    return `Type Game.io("help") to see available commands.\n${parseResult.error}`
  }
}

/**
 * - [ ] "/'で囲われたスペースを許可する
 */
function parseCommand(rawCommand: string): ResultType<ConsoleCommand> {
  const invalidCommandDescription = (description: string): ResultFailed => {
    return new ResultFailed(new Error(`Parsing command failed: ${description} (raw command: "${rawCommand}")`))
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
    return new ResultSucceeded(new HelpCommand(options, args, rawCommand))

  case "kill":
    return new ResultSucceeded(new KillCommand(options, args, rawCommand))

  case "launch":
    return new ResultSucceeded(new LaunchCommand(options, args, rawCommand))

  case "process":
    return new ResultSucceeded(new ProcessCommand(options, args, rawCommand))
  }
}

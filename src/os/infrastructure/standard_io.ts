import { ResultType, ResultFailed, ResultSucceeded } from "utility/result"
import {
  ConsoleCommand,
  isConsoleCommand,
  HelpCommand,
} from "./console_command"

export const standardInput = (rawMessage: string): string => {
  const parseResult = parseMessage(rawMessage)
  switch (parseResult.resultType) {
  case "succeeded":
    return parseResult.value.run()

  case "failed":
    return `Type Game.io("help") to see available commands.\n${parseResult.error}`

  default:
    return "Undefined behavior"
  }
}

/**
 * - [ ] "/'で囲われたスペースを許可する
 */
function parseMessage(rawMessage: string): ResultType<ConsoleCommand> {
  const invalidMessageDescription = (description: string): ResultFailed => {
    return new ResultFailed(new Error(`Parsing message failed: ${description} (raw message: "${rawMessage}")`))
  }

  const components = rawMessage.split(" ")
  if (components.length <= 0) {
    return invalidMessageDescription("Empty Message")
  }

  const command = components[0]
  if (isConsoleCommand(command) === false) {
    return invalidMessageDescription(`Unknown command ${command}`)
  }

  switch (command) {
  case "help":
  default:
    return new ResultSucceeded(new HelpCommand())
  }
}

/**
 * - [ ] logger以外からは直接呼ばれないようにする
 */
const standardOutput = (message: string, shouldNotify?: boolean): void => {

}

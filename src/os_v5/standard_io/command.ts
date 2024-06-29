import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"


export type CommandOutput = {
  readonly outputType: "output" | "error"
  readonly message: string
}


export type ObjectParserCommand<T> = {
  readonly command: string

  help(): string

  /** @throws */
  run(argumentParser: ArgumentParser): T
}

export type Command = ObjectParserCommand<string | CommandOutput[]>


const runCommandswith = <CommandOutput, Output>(
  argumentParser: ArgumentParser,
  commandRunners: ObjectParserCommand<CommandOutput>[],
  runCommand: (command: ObjectParserCommand<CommandOutput>, argumentParser: ArgumentParser) => Output
): Output => {
  const availableCommands = new Map<string, ObjectParserCommand<CommandOutput>>(commandRunners.map(command => [command.command, command]))

  const command = argumentParser.string([0, "command"]).parseOptional()
  const parentCommands = argumentParser.negativeOffsetElements()
  argumentParser.moveOffset(+1)

  const helpText = [
    "Available commands are:",
    ...Array.from(availableCommands.values()).map(runner => `- ${runner.command}`)
  ].join("\n")

  if (command == null || command.length <= 0 || command === "help") {
    throw helpText
  }

  const commandRunner = availableCommands.get(command)
  if (commandRunner != null) {
    if (argumentParser.string([0, null]).parseOptional() === "help") {
      throw [
        ...parentCommands,
        commandRunner.help(),
      ].join(" ")
    }
    return runCommand(commandRunner, argumentParser)
  }

  throw `Unknown command "${command}", ${helpText}`
}


export const runObjectParserCommands = <T>(argumentParser: ArgumentParser, commandRunners: ObjectParserCommand<T>[]): T => {
  return runCommandswith(argumentParser, commandRunners, (command, argumentParser) => command.run(argumentParser))
}

export const runCommands = (argumentParser: ArgumentParser, commandRunners: Command[]): string => {
  return runCommandswith<string | CommandOutput[], string>(argumentParser, commandRunners, (command, argumentParser) => runCommand(command, argumentParser))
}


const runCommand = (command: Command, argumentParser: ArgumentParser): string => {
  const output = command.run(argumentParser)
  if (typeof output === "string") {
    return output
  } else {
    const messages: string[] = output.map(line => {
      switch (line.outputType) {
      case "output":
        return line.message
      case "error":
        return `${ConsoleUtility.colored("[ERROR]", "error")} ${line.message}`
      default: {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _: never = line.outputType
        return ""
      }
      }
    })
    return messages.join("\n")
  }
}

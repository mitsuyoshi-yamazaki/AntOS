import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"


export type CommandOutput = {
  readonly outputType: "output" | "error"
  readonly message: string
}


export type ObjectParserCommand<AdditionalArgument, ReturnValue> = {
  readonly command: string

  help(): string

  /** @throws */
  run(argumentParser: ArgumentParser, args: AdditionalArgument): ReturnValue
}

export type Command = ObjectParserCommand<void, string | CommandOutput[]>


const runCommandswith = <AdditionalArgument, CommandOutput, Output>(
  argumentParser: ArgumentParser,
  commandRunners: ObjectParserCommand<AdditionalArgument, CommandOutput>[],
  runCommand: (command: ObjectParserCommand<AdditionalArgument, CommandOutput>, argumentParser: ArgumentParser, eachAdditionalArgument: AdditionalArgument) => Output,
  additionalArgument: AdditionalArgument,
): Output => {
  const availableCommands = new Map<string, ObjectParserCommand<AdditionalArgument, CommandOutput>>(commandRunners.map(command => [command.command, command]))

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
    return runCommand(commandRunner, argumentParser, additionalArgument)
  }

  throw `Unknown command "${command}", ${helpText}`
}


export const runObjectParserCommands = <AdditionalArgument, ReturnValue>(argumentParser: ArgumentParser, commandRunners: ObjectParserCommand<AdditionalArgument, ReturnValue>[], additionalArgument: AdditionalArgument): ReturnValue => {
  return runCommandswith(argumentParser, commandRunners, (command, argumentParser) => command.run(argumentParser, additionalArgument), additionalArgument)
}

export const runCommands = (argumentParser: ArgumentParser, commandRunners: Command[]): string => {
  return runCommandswith<void, string | CommandOutput[], string>(argumentParser, commandRunners, (command, argumentParser) => runCommand(command, argumentParser, undefined), undefined)
}

export const runCommandsWith = <AdditionalArgument, ReturnType extends string | CommandOutput[]>(argumentParser: ArgumentParser, additionalArgument: AdditionalArgument, commandRunners: ObjectParserCommand<AdditionalArgument, ReturnType>[]): string => {
  return runCommandswith<AdditionalArgument, ReturnType, string>(argumentParser, commandRunners, (command, argumentParser, eachAdditionalArgument) => runCommand(command, argumentParser, eachAdditionalArgument), additionalArgument)
}


const runCommand = <AdditionalArgument>(command: ObjectParserCommand<AdditionalArgument, string | CommandOutput[]>, argumentParser: ArgumentParser, additionalArgument: AdditionalArgument): string => {
  const output = command.run(argumentParser, additionalArgument)
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

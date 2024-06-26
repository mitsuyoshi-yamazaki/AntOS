import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"

export type CommandOutput = {
  readonly outputType: "output" | "error"
  readonly message: string
}

export type Command = {
  readonly command: string

  help(): string

  /** @throws */
  run(argumentParser: ArgumentParser): string | CommandOutput[]
}

export const runCommands = (argumentParser: ArgumentParser, commandRunners: Command[]): string => {
  const availableCommands = new Map<string, Command>(commandRunners.map(command => [command.command, command]))

  const command = argumentParser.string([0, "command"]).parseOptional()
  const parentCommands = argumentParser.negativeOffsetElements()
  argumentParser.moveOffset(+1)

  const helpText = [
    "Available commands are:",
    ...Array.from(availableCommands.values()).map(runner => `- ${runner.command}`)
  ].join("\n")

  if (command == null || command.length <= 0 || command === "help") {
    return helpText
  }

  const commandRunner = availableCommands.get(command)
  if (commandRunner != null) {
    if (argumentParser.string([0, null]).parseOptional() === "help") {
      return [
        ...parentCommands,
        commandRunner.help(),
      ].join(" ")
    }
    return runCommand(commandRunner, argumentParser)
  }

  throw `Unknown command "${command}", ${helpText}`
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

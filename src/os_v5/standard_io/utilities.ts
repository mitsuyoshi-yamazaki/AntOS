import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Command } from "./command"

/** @throws */
export const runCommand = (command: Command, args: string[]): string => {
  if (args[0] === "help") {
    args.shift()
    return command.help(args)
  }

  const output = command.run(args)
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

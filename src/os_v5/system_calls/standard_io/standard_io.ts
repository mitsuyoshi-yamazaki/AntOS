import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { SystemCall } from "../../system_call"
import { Command } from "./command"

type StandardIO = {
  io(input: string): string
}

export const StandardIO: SystemCall & StandardIO = {
  name: "StandardIO",

  load(): void {
  },

  startOfTick(): void {
  },

  endOfTick(): void {
  },

  io(input: string): string {
    try {
      const args = input.split(" ")
      const command = args.shift()

      switch (command) {
      case null:
      case undefined:
        throw "command is null"

      default:
        throw `unknown command "${command}"`
      }
    } catch (error) {
      return `${ConsoleUtility.colored("[ERROR]", "error")} ${error}`
    }
  },
}

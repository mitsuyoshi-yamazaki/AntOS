import { Command } from "../command"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"


export const SettingCommand: Command = {
  command: "setting",

  help(): string {
    return "setting {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return "OK"
  },
}

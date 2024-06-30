import { Logger } from "os_v5/system_calls/logger"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { Command, runCommands } from "../command"


const EnableProcessCommand: Command = {
  command: "enable",

  help(): string {
    return "enable {process IDs} {duration}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const processes = argumentParser.list([0, "process IDs"], "process").parse()
    const processIds = processes.map(process => process.processId)

    const duration = argumentParser.int([1, "duration"]).parse({min: 1})

    Logger.setLogEnabledFor(processIds, duration)

    return `Log enabled for ${processes.length} processes`
  },
}

const DisableProcessCommand: Command = {
  command: "disable",

  help(): string {
    return "disable {process IDs}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const processes = argumentParser.list([0, "process IDs"], "process").parse()
    const processIds = processes.map(process => process.processId)

    Logger.setLogDisabled(processIds)

    return `Log disabled for ${processes.length} processes`
  },
}

const ShowProcessCommand: Command = {
  command: "show",

  help(): string {
    return "show"
  },

  /** @throws */
  run(): string {
    const results: string[] = [
      alignedText("Process", "Duration"),
      ...Logger.enabledProcesses().map((processInfo): string => {
        return alignedText(`${processInfo.process}`, ConsoleUtility.shortenedNumber(processInfo.duration))
      })
    ]

    return results.join("\n")
  },
}


const commandRunners: Command[] = [
  EnableProcessCommand,
  DisableProcessCommand,
  ShowProcessCommand,
]


export const LoggerCommand: Command = {
  command: "logger",

  help(): string {
    return "logger {command} {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, commandRunners)
  },
}


const tab = ConsoleUtility.tab
const TabSize = ConsoleUtility.TabSize

const alignedText = (processInfo: string, duration: string): string => {
  return `${tab(processInfo, TabSize.veryLarge)} ${tab(duration, TabSize.small)}`
}

import { Command, runCommands } from "os_v5/standard_io/command"
import { ProcessManager } from "os_v5/system_calls/process_manager/process_manager"
import { ArgumentParser } from "os_v5/utility/v5_argument_parser/argument_parser"


const ShowThresholdCommand: Command = {
  command: "show",

  help(): string {
    return "show"
  },

  /** @throws */
  run(): string {
    return `Current threshold: ${ProcessManager.cpuUsageThreshold()}`
  },
}

const SetThresholdCommand: Command = {
  command: "set",

  help(): string {
    return "set {cpu threshold}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    const threshold = argumentParser.int([0, "cpu threshold"]).parse({ min: 1, max: Game.cpu.tickLimit })
    const currentThreshold = ProcessManager.cpuUsageThreshold()
    ProcessManager.setCpuUsageThreshold(threshold)

    return `Set threshold: ${ProcessManager.cpuUsageThreshold()} (from ${currentThreshold})`
  },
}

const ThresholdCommand: Command = {
  command: "threshold",

  help(): string {
    return "threshold {show | set}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, [
      ShowThresholdCommand,
      SetThresholdCommand,
    ])
  },
}


const commandRunners: Command[] = [
  ThresholdCommand,
]

export const ProcessCommand: Command = {
  command: "process",

  help(): string {
    return "process {setting} {...args}"
  },

  /** @throws */
  run(argumentParser: ArgumentParser): string {
    return runCommands(argumentParser, commandRunners)
  },
}

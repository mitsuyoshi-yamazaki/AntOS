import { startsWith } from "lodash"
import { OperatingSystem } from "os/os"
import { parseProcessId } from "./command_utility"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class ProcessCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    if (this.options.has("-l")) {
      return this.listProcess()
    }
    return "Nothing to do"
  }

  private listProcess(): CommandExecutionResult {
    const spaces = "                                                  " // 50 spaces
    const tab = (str: string, tabs: number): string => {
      const numberOfSpaces = Math.max(tabs - str.length, 0)
      const spacer = spaces.slice(0, numberOfSpaces)
      return `${str}${spacer}`
    }
    const largeTab = 30
    const mediumTab = 20
    const smallTab = 10

    const startString = `${tab("PID", mediumTab)}${tab("Type", largeTab)}${tab("Running", smallTab)}`
    return OperatingSystem.os.listAllProcesses().reduce((result, current) => {
      return `${result}\n${tab(`${current.processId}`, mediumTab)}${tab(`${current.type}`, largeTab)}${tab(`${current.running}`, smallTab)}`
    }, startString)
  }
}

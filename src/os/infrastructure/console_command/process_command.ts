import { OperatingSystem } from "os/os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class ProcessCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    if (this.args[0] != null) {
      return this.describeProcess(this.args[0])
    }
    return this.listProcess()
  }

  private describeProcess(processId: string): CommandExecutionResult {
    const parsedId = parseInt(processId, 10)
    if (isNaN(parsedId)) {
      return `Invalid process ID: ${processId}`
    }
    const processInfo = OperatingSystem.os.processInfoOf(parsedId)
    if (processInfo == null) {
      return `No process for process ID ${parsedId}`
    }

    const basicDescription = `${processInfo.processId} ${processInfo.type}, running: ${processInfo.running}`
    if (processInfo.process.processDescription != null) {
      return `${basicDescription}\n${processInfo.process.processDescription()}`
    } else {
      return basicDescription
    }
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

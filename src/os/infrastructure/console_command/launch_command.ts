import { TestProcess } from "task/test/test_process"
import { OperatingSystem } from "../../os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"

export class LaunchCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    switch (this.args[0]) {
    case "TestProcess":
      return this.launchTestProcess()
    default:
      return `Invalid process type name ${this.args[0]}`
    }
  }

  private parseProcessArguments(): Map<string, string> {
    const args = this.args.concat([])
    args.splice(0, 1)
    const result = new Map<string, string>()
    args.forEach(arg => {
      const components = arg.split("=")
      if (components.length !== 2) {
        return
      }
      result.set(components[0], components[1])
    })
    return result
  }

  private launchTestProcess(): CommandExecutionResult {
    const process = OperatingSystem.os.addProcess(processId => {
      return new TestProcess(Game.time, processId)
    })
    return `Launched TestProcess PID: ${process.processId}`
  }

  // private launchScoutCreepProcess(processArguments: Map<string, string>): CommandExecutionResult {
  //   const creepId = processArguments.get("creep_id")
  //   const routes = processArguments.get("routes")?.split(",")

  //   if (creepId == null) {
  //     return "Missing creep_id argument"
  //   }
  //   if (routes == null) {
  //     return "Missing routes argument"
  //   }

  //   const process = OperatingSystem.os.addProcess(processId => {
  //     return new ScoutCreepProcess(Game.time, processId, creepId, routes)
  //   })
  //   return `Launched ScoutCreepProcess PID: ${process.processId}`
  // }
}

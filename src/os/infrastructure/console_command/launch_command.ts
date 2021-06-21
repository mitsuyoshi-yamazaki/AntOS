import { OperatingSystem } from "../../os"
import { ScoutCreepProcess } from "../../../process/one_time_process/scout_creep"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { LaunchRoomProcess } from "process/one_time_process/launch_room"

export class LaunchCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    if (this.args.length < 1) {
      return "No process type name specified"
    }
    const rawProcessArguments = this.args.concat([])
    rawProcessArguments.splice(0, 1)
    return this.launchProcess(this.args[0], rawProcessArguments)
  }

  private launchProcess(processTypeName: string, args: string[]): CommandExecutionResult {
    const processArguments = this.parseProcessArguments(args)
    switch (processTypeName) {
    case "ScoutCreepProcess":
      return this.launchScoutCreepProcess(processArguments)
    case "LaunchRoomProcess":
      return this.launchLaunchRoomProcess(processArguments)
    default:
      return `Invalid process type name ${processTypeName}`
    }
  }

  private parseProcessArguments(args: string[]): Map<string, string> {
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

  private launchScoutCreepProcess(processArguments: Map<string, string>): CommandExecutionResult {
    const creepId = processArguments.get("creep_id")
    const routes = processArguments.get("routes")?.split(",")

    if (creepId == null) {
      return "Missing creep_id argument"
    }
    if (routes == null) {
      return "Missing routes argument"
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return new ScoutCreepProcess(Game.time, processId, creepId, routes)
    })
    return `Launched ScoutCreepProcess PID: ${process.processId}`
  }

  private launchLaunchRoomProcess(processArguments: Map<string, string>): CommandExecutionResult {
    const roomName = processArguments.get("room_name")

    if (roomName == null) {
      return "Missing room_name argument"
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return new LaunchRoomProcess(Game.time, processId, roomName, null, [])
    })
    return `Launched LaunchRoomProcess PID: ${process.processId}`
  }
}

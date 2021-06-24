import { SignRoomsProcess } from "task/sign_rooms/sign_rooms_process"
import { TestProcess } from "task/test/test_process"
import { OperatingSystem } from "os/os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { SignRoomObjective } from "task/sign_rooms/sign_rooms_objective"
import { BootstrapRoomProcess } from "task/bootstrap_room/bootstrap_room_proces"
import { BootstrapRoomObjective } from "task/bootstrap_room/bootstarp_room_objective"

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
    case "SignRoomsProcess":
      return this.launchSignRoomsProcess()
    case "BootstrapRoomProcess":
      return this.launchBootstrapRoomProcess()
    default:
      return `Invalid process type name ${this.args[0]}`
    }
  }

  // ---- Argument parser ---- //
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

  private missingArgumentError(argumentName: string): string {
    return `Missing ${argumentName} argument`
  }

  // ---- Launcher ---- //
  private launchTestProcess(): CommandExecutionResult {
    const process = OperatingSystem.os.addProcess(processId => {
      return new TestProcess(Game.time, processId)
    })
    return `Launched ${process.constructor.name} PID: ${process.processId}`
  }

  private launchSignRoomsProcess(): CommandExecutionResult {
    const args = this.parseProcessArguments()

    const baseRoomName = args.get("base_room_name")
    if (baseRoomName == null) {
      return this.missingArgumentError("base_room_name")
    }

    const mark = args.get("mark")
    if (mark == null) {
      return this.missingArgumentError("mark")
    }

    const targets = args.get("target_room_names")
    if (targets == null) {
      return this.missingArgumentError("target_room_names")
    }
    const targetRoomName = targets.split(",")

    const launchTime = Game.time
    const objective = new SignRoomObjective(launchTime, [], targetRoomName, mark, baseRoomName, null, null, null)

    const process = OperatingSystem.os.addProcess(processId => {
      return new SignRoomsProcess(launchTime, processId, objective)
    })
    return `Launched ${process.constructor.name} PID: ${process.processId}`
  }

  private launchBootstrapRoomProcess(): CommandExecutionResult {
    const launchTime = Game.time
    const objective = new BootstrapRoomObjective(launchTime, [])

    const process = OperatingSystem.os.addProcess(processId => {
      return new BootstrapRoomProcess(launchTime, processId, objective)
    })
    return `Launched ${process.constructor.name} PID: ${process.processId}`
  }
}

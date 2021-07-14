import { Process } from "process/process"
import { TestProcess } from "process/test/test_process"
import { OperatingSystem } from "os/os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { Result, ResultFailed } from "utility/result"
import { RouteCheckTask } from "v5_task/scout/route_check_task"
import { TaskProcess } from "process/task_process"
import { Season487837AttackInvaderCoreProcess } from "process/onetime/season_487837_attack_invader_core_process"
import { Season553093AttackRcl3RoomProcess } from "process/onetime/season_553093_attack_rcl3_room_process"
import { RoomName } from "utility/room_name"
// import { OnetimeTaskProcess } from "process/onetime/onetime_task_process"
// import { ScoutRoomTask } from "task/scout/scout_room_task"

type LaunchCommandResult = Result<Process, string>

export class LaunchCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    let result: LaunchCommandResult | null = null
    switch (this.args[0]) {
    case "TestProcess":
      result = this.launchTestProcess()
      break
    case "OnetimeTaskProcess":
      result = this.launchOnetimeTaskProcess()
      break
    case "RouteCheckTask":
      result = this.launchRouteCheckTask()
      break
    case "Season487837AttackInvaderCoreProcess":
      result = this.launchSeason487837AttackInvaderCoreProcess()
      break
    case "Season553093AttackRcl3RoomProcess":
      result = this.launchSeason553093AttackRcl3RoomProcess()
      break
    default:
      break
    }
    if (result == null) {
      return `Invalid process type name ${this.args[0]}`
    }

    switch (result.resultType) {
    case "succeeded": {
      let detail = ""
      if (this.options.get("-l") != null) {
        const logger = OperatingSystem.os.getLoggerProcess()
        if (logger) {
          const loggerResult = logger.didReceiveMessage(`add id ${result.value.processId}`)
          detail = `, ${loggerResult}`
        } else {
          detail = ", missing logger process"
        }
      }
      return `Launched ${result.value.constructor.name}, PID: ${result.value.processId}${detail}`
    }
    case "failed":
      return result.reason
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

  private missingArgumentError(argumentName: string): ResultFailed<string> {
    return Result.Failed(`Missing ${argumentName} argument`)
  }

  // ---- Launcher ---- //
  private launchTestProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(processId => {
      return TestProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchOnetimeTaskProcess(): LaunchCommandResult {
    // const args = this.parseProcessArguments()

    // const roomName = args.get("room_name")
    // if (roomName == null) {
    //   return this.missingArgumentError("room_name")
    // }

    // const targetRoomName = args.get("target_room_name")
    // if (targetRoomName == null) {
    //   return this.missingArgumentError("target_room_name")
    // }

    // const rawWaypoints = args.get("waypoints")
    // if (rawWaypoints == null) {
    //   return this.missingArgumentError("waypoints")
    // }
    // const waypoints = rawWaypoints.split(",")

    // const task = ScoutRoomTask.create(roomName, targetRoomName, waypoints)

    // const process = OperatingSystem.os.addProcess(processId => {
    //   return OnetimeTaskProcess.create(processId, roomName, task)
    // })
    // return Result.Succeeded(process)
    return Result.Failed("")
  }

  private launchRouteCheckTask(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }
    const rawWaypoints = args.get("waypoints")
    if (rawWaypoints == null) {
      return this.missingArgumentError("waypoints")
    }
    const waypoints = rawWaypoints.split(",")

    const task = RouteCheckTask.create(roomName, targetRoomName, waypoints)
    const process = OperatingSystem.os.addProcess(processId => {
      return TaskProcess.create(processId, task)
    })
    return Result.Succeeded(process)
  }

  private launchSeason487837AttackInvaderCoreProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(processId => {
      return Season487837AttackInvaderCoreProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchSeason553093AttackRcl3RoomProcess(): LaunchCommandResult {
    const parentRoomName = "W24S29"
    const targetRoomName = "W21S14"
    const waypoints: RoomName[] = ["W24S30", "W20S30", "W20S14"]

    const process = OperatingSystem.os.addProcess(processId => {
      return Season553093AttackRcl3RoomProcess.create(processId, parentRoomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }
}

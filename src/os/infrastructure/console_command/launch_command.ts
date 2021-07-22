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
import { Season570208DismantleRcl2RoomProcess } from "process/onetime/season_570208_dismantle_rcl2_room_process"
import { Season617434PowerHarvestProcess } from "process/onetime/season_617434_power_harvest_process"
import { Season631744PowerProcessProcess } from "process/onetime/season_631744_power_process_process"
import { World } from "world_info/world_info"
import { roomLink } from "utility/log"
import { Season634603PowerCreepProcess } from "process/onetime/season_634603_power_creep_process"
import { Season687888RunHaulerTestProcess } from "process/onetime/season_687888_run_hauler_test_process"
import { TransferResourceApiWrapperTargetType } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { Season701205PowerHarvesterSwampRunnerProcess } from "process/onetime/season_701205_power_harvester_swamp_runner_process"
import { Season812484StealPowerProcess } from "process/onetime/season_812484_steal_power_process"
import { Season831595DismantleRcl2RoomProcess } from "process/onetime/season_831595_dismantle_rcl2_room_process"
import { Season845677Attack1TowerProcess } from "process/onetime/season_845677_attack_1tower_process"
import { V6RoomKeeperProcess } from "process/v6_room_keeper_process"
import { RoomKeeperTask } from "application/task/room_keeper/room_keeper_task"

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
    case "RouteCheckTask":
      result = this.launchRouteCheckTask()
      break
    case "Season487837AttackInvaderCoreProcess":
      result = this.launchSeason487837AttackInvaderCoreProcess()
      break
    case "Season553093AttackRcl3RoomProcess":
      result = this.launchSeason553093AttackRcl3RoomProcess()
      break
    case "Season570208DismantleRcl2RoomProcess":
      result = this.launchSeason570208DismantleRcl2RoomProcess()
      break
    case "Season617434PowerHarvestProcess":
      result = this.launchSeason617434PowerHarvestProcess()
      break
    case "Season631744PowerProcessProcess":
      result = this.launchSeason631744PowerProcessProcess()
      break
    case "Season634603PowerCreepProcess":
      result = this.launchSeason634603PowerCreepProcess()
      break
    case "Season687888RunHaulerTestProcess":
      result = this.launchSeason687888RunHaulerTestProcess()
      break
    case "Season701205PowerHarvesterSwampRunnerProcess":
      result = this.launchSeason701205PowerHarvesterSwampRunnerProcess()
      break
    case "Season812484StealPowerProcess":
      result = this.launchSeason812484StealPowerProcess()
      break
    case "Season831595DismantleRcl2RoomProcess":
      result = this.launchSeason831595DismantleRcl2RoomProcess()
      break
    case "Season845677Attack1TowerProcess":
      result = this.launchSeason845677Attack1TowerProcess()
      break
    case "V6RoomKeeperProcess":
      result = this.launchV6RoomKeeperProcess()
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
      const [key, value] = arg.split("=")
      if (key == null || value == null) {
        return
      }
      result.set(key, value)
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

  private launchSeason570208DismantleRcl2RoomProcess(): LaunchCommandResult {
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


    // const parentRoomName = "W27S26"
    // const targetRoomName = "W25S22"
    // const waypoints: RoomName[] = ["W26S26", "W26S25", "W24S25", "W24S22"]

    // const parentRoomName = "W9S24"
    // const targetRoomName = "W3S27"
    // const waypoints: RoomName[] = ["W3S25"]

    const process = OperatingSystem.os.addProcess(processId => {
      return Season570208DismantleRcl2RoomProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason617434PowerHarvestProcess(): LaunchCommandResult {
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

    const process = OperatingSystem.os.addProcess(processId => {
      return Season617434PowerHarvestProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason631744PowerProcessProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const powerSpawn = World.rooms.getOwnedRoomObjects(roomName)?.activeStructures.powerSpawn
    if (powerSpawn == null) {
      return Result.Failed(`No power spawn in ${roomLink(roomName)}`)
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season631744PowerProcessProcess.create(processId, roomName, powerSpawn.id)
    })
    return Result.Succeeded(process)
  }

  private launchSeason634603PowerCreepProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const powerCreepName = args.get("power_creep_name")
    if (powerCreepName == null) {
      return this.missingArgumentError("power_creep_name")
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season634603PowerCreepProcess.create(processId, roomName, powerCreepName)
    })
    return Result.Succeeded(process)
  }

  private launchSeason687888RunHaulerTestProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const transferTargetId = args.get("transfer_target_id")
    if (transferTargetId == null) {
      return this.missingArgumentError("transfer_target_id")
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season687888RunHaulerTestProcess.create(processId, roomName, transferTargetId as Id<TransferResourceApiWrapperTargetType>)
    })
    return Result.Succeeded(process)
  }

  private launchSeason701205PowerHarvesterSwampRunnerProcess(): LaunchCommandResult {
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

    const process = OperatingSystem.os.addProcess(processId => {
      return Season701205PowerHarvesterSwampRunnerProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason812484StealPowerProcess(): LaunchCommandResult {
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

    const process = OperatingSystem.os.addProcess(processId => {
      return Season812484StealPowerProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason831595DismantleRcl2RoomProcess(): LaunchCommandResult {
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

    const process = OperatingSystem.os.addProcess(processId => {
      return Season831595DismantleRcl2RoomProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason845677Attack1TowerProcess(): LaunchCommandResult {
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

    const waitingPosition = new RoomPosition(10, 48, roomName)

    const process = OperatingSystem.os.addProcess(processId => {
      return Season845677Attack1TowerProcess.create(processId, roomName, targetRoomName, waypoints, waitingPosition)
    })
    return Result.Succeeded(process)
  }

  private launchV6RoomKeeperProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }

    const task = RoomKeeperTask.create(roomName)

    const process = OperatingSystem.os.addProcess(processId => {
      return V6RoomKeeperProcess.create(processId, task)
    })
    return Result.Succeeded(process)
  }
}

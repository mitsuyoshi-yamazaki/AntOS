import { Process } from "process/process"
import { TestProcess } from "process/test/test_process"
import { OperatingSystem } from "os/os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { Result, ResultFailed } from "utility/result"
import { RouteCheckTask } from "v5_task/scout/route_check_task"
import { TaskProcess } from "process/task_process"
import { Season487837AttackInvaderCoreProcess } from "process/onetime/season_487837_attack_invader_core_process"
import { Season553093AttackRcl3RoomProcess } from "process/onetime/season_553093_attack_rcl3_room_process"
import { RoomName, roomTypeOf } from "utility/room_name"
import { Season570208DismantleRcl2RoomProcess } from "process/onetime/season_570208_dismantle_rcl2_room_process"
import { Season631744PowerProcessProcess } from "process/onetime/season_631744_power_process_process"
import { World } from "world_info/world_info"
import { coloredText, roomLink } from "utility/log"
import { Season634603PowerCreepProcess } from "process/onetime/season_634603_power_creep_process"
import { Season701205PowerHarvesterSwampRunnerProcess } from "process/onetime/season_701205_power_harvester_swamp_runner_process"
import { Season812484StealPowerProcess } from "process/onetime/season_812484_steal_power_process"
import { Season845677Attack1TowerProcess } from "process/onetime/season_845677_attack_1tower_process"
import { V6RoomKeeperProcess } from "process/v6_room_keeper_process"
import { RoomKeeperTask } from "application/task/room_keeper/room_keeper_task"
import { Season989041MovePowerCreepProcess } from "process/onetime/season_989041_move_power_creep_process"
import { Season1022818Attack2TowerRoomProcess, Season1022818Attack2TowerRoomProcessAttackType } from "process/onetime/season_1022818_attack_2tower_room_process"
import { BuyPixelProcess } from "process/process/buy_pixel_process"
import { Environment } from "utility/environment"
import { Season1105755HarvestMineralProcess } from "process/onetime/season_1105755_harvest_mineral_process"
import { Season1143119LabChargerProcess } from "process/onetime/season_1143119_lab_charger_process"
import { Season1143119BoostedAttackProcess } from "process/onetime/season_1143119_boosted_attack_process"
import { Season1200082SendMineralProcess } from "process/onetime/season_1200082_send_mineral_process"
import { Season1244215GenericDismantleProcess } from "process/onetime/season_1244215_generic_dismantle_process"
import { Season1249418SendHugeCreepProcess } from "process/onetime/season_1249418_send_huge_creep_process"
import { Season1262745GuardRemoteRoomProcess } from "process/onetime/season_1262745_guard_remote_room_process"
import { PrimitiveLogger } from "../primitive_logger"
import { Season1349943DisturbPowerHarvestingProcess } from "process/onetime/season_1349943_disturb_power_harvesting_process"
import { Season831595DismantleRcl2RoomProcess } from "process/onetime/season_831595_dismantle_rcl2_room_process"
import { Season1488500QuadProcess } from "process/onetime/season_1488500_quad_process"
import { Season1521073SendResourceProcess } from "process/onetime/season_1521073_send_resource_process"

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
    case "Season631744PowerProcessProcess":
      result = this.launchSeason631744PowerProcessProcess()
      break
    case "Season634603PowerCreepProcess":
      result = this.launchSeason634603PowerCreepProcess()
      break
    case "Season701205PowerHarvesterSwampRunnerProcess":
      result = this.launchSeason701205PowerHarvesterSwampRunnerProcess()
      break
    case "Season812484StealPowerProcess":
      result = this.launchSeason812484StealPowerProcess()
      break
    case "Season845677Attack1TowerProcess":
      result = this.launchSeason845677Attack1TowerProcess()
      break
    case "V6RoomKeeperProcess":
      result = this.launchV6RoomKeeperProcess()
      break
    case "Season989041MovePowerCreepProcess":
      result = this.launchSeason989041MovePowerCreepProcess()
      break
    case "Season1022818Attack2TowerRoomProcess":
      result = this.launchSeason1022818Attack2TowerRoomProcess()
      break
    case "BuyPixelProcess":
      result = this.launchBuyPixelProcess()
      break
    case "Season1105755HarvestMineralProcess":
      result = this.launchSeason1105755HarvestMineralProcess()
      break
    case "Season1143119LabChargerProcess":
      result = this.launchSeason1143119LabChargerProcess()
      break
    case "Season1143119BoostedAttackProcess":
      result = this.launchSeason1143119BoostedAttackProcess()
      break
    case "Season1200082SendMineralProcess":
      result = this.launchSeason1200082SendMineralProcess()
      break
    case "Season1249418SendHugeCreepProcess":
      result = this.launchSeason1249418SendHugeCreepProcess()
      break
    case "Season1262745GuardRemoteRoomProcess":
      result = this.launchSeason1262745GuardRemoteRoomProcess()
      break
    case "Season1349943DisturbPowerHarvestingProcess":
      result = this.launchSeason1349943DisturbPowerHarvestingProcess()
      break
    case "Season831595DismantleRcl2RoomProcess":
      result = this.launchSeason831595DismantleRcl2RoomProcess()
      break
    case "Season1488500QuadProcess":
      result = this.launchSeason1488500QuadProcess()
      break
    case "Season1521073SendResourceProcess":
      result = this.launchSeason1521073SendResourceProcess()
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

    const neighbourCount = ((): number => {
      const targetRoom = Game.rooms[targetRoomName]
      if (targetRoom == null) {
        PrimitiveLogger.fatal(`launchSeason701205PowerHarvesterSwampRunnerProcess no visible to ${roomLink(targetRoomName)}`)
        return 3
      }
      const powerBank = targetRoom.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_POWER_BANK } })[0]
      if (powerBank == null) {
        PrimitiveLogger.fatal(`launchSeason701205PowerHarvesterSwampRunnerProcess no power bank found in ${roomLink(targetRoomName)}`)
        return 3
      }
      return powerBank.pos.positionsInRange(1, {
        excludeItself: true,
        excludeTerrainWalls: true,
        excludeStructures: true,
        excludeWalkableStructures: false,
      }).length
    })()

    const dryRun = args.get("dry_run")
    if (dryRun != null) {
      return Result.Failed(`${coloredText("[Dry Run]", "warn")} Season701205PowerHarvesterSwampRunnerProcess ${roomLink(targetRoomName)}, ${neighbourCount} attacker points`)
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season701205PowerHarvesterSwampRunnerProcess.create(processId, roomName, targetRoomName, waypoints, neighbourCount)
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

  private launchSeason989041MovePowerCreepProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const fromRoomName = args.get("from_room_name")
    if (fromRoomName == null) {
      return this.missingArgumentError("from_room_name")
    }
    const toRoomName = args.get("to_room_name")
    if (toRoomName == null) {
      return this.missingArgumentError("to_room_name")
    }
    const rawWaypoints = args.get("waypoints")
    if (rawWaypoints == null) {
      return this.missingArgumentError("waypoints")
    }
    const waypoints = rawWaypoints.split(",")

    const powerCreepName = args.get("power_creep_name")
    if (powerCreepName == null) {
      return this.missingArgumentError("power_creep_name")
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season989041MovePowerCreepProcess.create(processId, fromRoomName, toRoomName, waypoints, powerCreepName)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1022818Attack2TowerRoomProcess(): LaunchCommandResult {
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

    const attackType = args.get("attack_type")
    if (attackType == null) {
      return this.missingArgumentError("attack_type")
    }
    if (["dismantle", "downgrade"].includes(attackType) !== true) {
      return Result.Failed(`Unsupported attack_type ${attackType}, available: ${["dismantle", "downgrade"]}`)
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season1022818Attack2TowerRoomProcess.create(processId, roomName, targetRoomName, waypoints, attackType as Season1022818Attack2TowerRoomProcessAttackType)
    })
    return Result.Succeeded(process)
  }

  private launchBuyPixelProcess(): LaunchCommandResult {
    if (Environment.world !== "persistent world") {
      return Result.Failed(`Environment ${Environment.world} does not support pixel`)
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return BuyPixelProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1105755HarvestMineralProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }
    const targetRoomType = roomTypeOf(targetRoomName)
    if (targetRoomType !== "source_keeper" && targetRoomType !== "sector_center") {
      return Result.Failed(`Invalid target_room_name ${targetRoomName}, room type: ${targetRoomType}`)
    }

    const rawWaypoints = args.get("waypoints")
    if (rawWaypoints == null) {
      return this.missingArgumentError("waypoints")
    }
    const waypoints = rawWaypoints.split(",")

    const process = OperatingSystem.os.addProcess(processId => {
      return Season1105755HarvestMineralProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1143119LabChargerProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const rawLabIds = args.get("lab_ids")
    if (rawLabIds == null) {
      return this.missingArgumentError("lab_ids")
    }
    const labIds = rawLabIds.split(",") as Id<StructureLab>[]

    const process = OperatingSystem.os.addProcess(processId => {
      return Season1143119LabChargerProcess.create(processId, roomName, labIds)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1143119BoostedAttackProcess(): LaunchCommandResult {
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

    const towerCount = args.get("tower_count")
    if (towerCount == null) {
      return this.missingArgumentError("tower_count")
    }
    const parsedTowerCount = parseInt(towerCount, 10)
    if (isNaN(parsedTowerCount) === true) {
      return Result.Failed(`tower_count is not a number (${towerCount})`)
    }
    if ([0, 1, 2, 3].includes(parsedTowerCount) !== true) {
      return Result.Failed(`Not supported tower_count ${parsedTowerCount}`)
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season1143119BoostedAttackProcess.create(processId, roomName, targetRoomName, waypoints, parsedTowerCount as (0 | 1 | 2 | 3))
    })
    return Result.Succeeded(process)
  }

  private launchSeason1200082SendMineralProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season1200082SendMineralProcess.create(processId, roomName, targetRoomName)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1244215GenericDismantleProcess(): LaunchCommandResult {
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
    const targetId = args.get("target_id")
    if (targetId == null) {
      return this.missingArgumentError("target_id")
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season1244215GenericDismantleProcess.create(processId, roomName, targetRoomName, waypoints, targetId as Id<AnyStructure>)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1249418SendHugeCreepProcess(): LaunchCommandResult {
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
      return Season1249418SendHugeCreepProcess.create(processId, roomName, targetRoomName, waypoints, "ranged attacker")
    })
    return Result.Succeeded(process)
  }

  private launchSeason1262745GuardRemoteRoomProcess(): LaunchCommandResult {
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
      return Season1262745GuardRemoteRoomProcess.create(processId, roomName, targetRoomName, waypoints, "ranged attacker")
    })
    return Result.Succeeded(process)
  }

  private launchSeason1349943DisturbPowerHarvestingProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const rawWaypoints = args.get("waypoints")
    if (rawWaypoints == null) {
      return this.missingArgumentError("waypoints")
    }
    const waypoints = rawWaypoints.split(",")
    const rawPatrolRooms = args.get("patrol_rooms")
    if (rawPatrolRooms == null) {
      return this.missingArgumentError("patrol_rooms")
    }
    const patrolRooms = rawPatrolRooms.split(",")
    const attackerType = args.get("attacker_type")
    if (attackerType == null) {
      return this.missingArgumentError("attacker_type")
    }
    if (["attacker", "ranged_attacker", "large_ranged_attacker"].includes(attackerType) !== true) {
      return Result.Failed(`Invalid attacker type: ${attackerType}`)
    }

    const process = OperatingSystem.os.addProcess(processId => {
      return Season1349943DisturbPowerHarvestingProcess.create(processId, roomName, waypoints, patrolRooms, attackerType as ("attacker" | "ranged_attacker" | "large_ranged_attacker"))
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

  private launchSeason1488500QuadProcess(): LaunchCommandResult {
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
      return Season1488500QuadProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1521073SendResourceProcess(): LaunchCommandResult {
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
      return Season1521073SendResourceProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }
}

import { Process } from "process/process"
import { TestChildProcess, TestProcess } from "process/test/test_process"
import { OperatingSystem } from "os/os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { Result, ResultFailed } from "utility/result"
import { Season487837AttackInvaderCoreProcess } from "process/temporary/season_487837_attack_invader_core_process"
import { Season570208DismantleRcl2RoomProcess } from "process/temporary/season_570208_dismantle_rcl2_room_process"
import { Season631744PowerProcessProcess } from "process/temporary/season_631744_power_process_process"
import { World } from "world_info/world_info"
import { coloredText, roomLink } from "utility/log"
import { Season634603PowerCreepProcess } from "process/temporary/season_634603_power_creep_process"
import { Season701205PowerHarvesterSwampRunnerProcess } from "process/temporary/season_701205_power_harvester_swamp_runner_process"
import { Season989041MovePowerCreepProcess } from "process/temporary/season_989041_move_power_creep_process"
import { BuyPixelProcess } from "process/process/buy_pixel_process"
import { Environment } from "utility/environment"
import { Season1143119LabChargerProcess, Season1143119LabChargerProcessLabInfo } from "process/temporary/season_1143119_lab_charger_process"
import { Season1200082SendMineralProcess } from "process/temporary/season_1200082_send_mineral_process"
import { Season1244215GenericDismantleProcess } from "process/temporary/season_1244215_generic_dismantle_process"
import { isGuardRemoteRoomProcessCreepType, GuardRemoteRoomProcess, GuardRemoteRoomProcessCreepType } from "process/process/guard_remote_room_process"
import { PrimitiveLogger } from "../primitive_logger"
import { Season1349943DisturbPowerHarvestingProcess } from "process/temporary/season_1349943_disturb_power_harvesting_process"
import { Season1521073SendResourceProcess } from "process/temporary/season_1521073_send_resource_process"
import { Season1606052SKHarvesterProcess } from "process/temporary/season_1606052_sk_harvester_process"
import { isDepositConstant, isMineralBoostConstant, isResourceConstant } from "utility/resource"
import { UpgradePowerCreepProcess } from "process/process/upgrade_power_creep_process"
import { Season1655635SKMineralHarvestProcess } from "process/temporary/season_1655635_sk_mineral_harvest_process"
import { Season1838855DistributorProcess } from "process/temporary/season_1838855_distributor_process"
import { StealResourceProcess } from "process/onetime/steal_resource_process"
// import { ConstructionSaboteurProcess } from "process/onetime/construction_saboteur_process"
import { Season2055924SendResourcesProcess } from "process/temporary/season_2055924_send_resources_process"
import { InterRoomResourceManagementProcess } from "process/process/inter_room_resource_management_process"
import { World35440623DowngradeControllerProcess } from "process/temporary/world_35440623_downgrade_controller_process"
import { ObserveRoomProcess } from "process/process/observe_room_process"
import { World35587255ScoutRoomProcess } from "process/temporary/world_35587255_scout_room_process"
import { World35872159TestDeclarationProcess } from "process/temporary/world_35872159_test_declaration_process"
import { World35872159TestResourcePoolProcess } from "process/temporary/world_35872159_test_resource_pool_process"
import { SectorName } from "utility/room_sector"
import { launchQuadProcess } from "process/onetime/submodule_process_launcher"
import { SubmoduleTestProcess } from "../../../../submodules/submodule_test_process"
import { AttackRoomProcess } from "process/onetime/attack/attack_room_process"
import { } from "process/temporary/season4_275982_harvest_commodity_manager_process"
import { MonitoringProcess, Target as MonitoringTarget, TargetHostileRoom as MonitoringTargetHostileRoom, TargetOwnedRoom as MonitoringTargetOwnedRoom } from "process/onetime/monitoring_process"
import { QuadMakerProcess } from "process/onetime/quad_maker_process"
import { GameMap } from "game/game_map"
import { RoomName } from "utility/room_name"
import { Season4332399SKMineralHarvestProcess } from "process/temporary/season4_332399_sk_mineral_harvest_process"
import { Season4275982HarvestCommodityProcess } from "process/temporary/season4_275982_harvest_commodity_process"
// import {} from "process/onetime/attack/drafting_room_process"
import { } from "process/process/produce_commodity_process"
import { ProcessLauncher } from "process/process_launcher"
import { KeywardArguments } from "./utility/keyward_argument_parser"

type LaunchCommandResult = Result<Process, string>

export class LaunchCommand implements ConsoleCommand {
  public constructor(
    public readonly options: Map<string, string>,
    public readonly args: string[],
    public readonly rawCommand: string,
  ) { }

  public run(): CommandExecutionResult {
    const args = [...this.args]
    const firstArgument = args.shift()
    if (firstArgument == null) {
      return `Unknown process type ${firstArgument}`
    }
    const processType = firstArgument

    const result = ((): LaunchCommandResult => {
      switch (processType) {
      case "TestProcess":
        return this.launchTestProcess()
      case "TestChildProcess":
        return this.launchTestChildProcess()
      case "SpecializedQuadProcess":
        return this.launchQuad()
      case "Season487837AttackInvaderCoreProcess":
        return this.launchSeason487837AttackInvaderCoreProcess()
      case "Season570208DismantleRcl2RoomProcess":
        return this.launchSeason570208DismantleRcl2RoomProcess()
      case "Season631744PowerProcessProcess":
        return this.launchSeason631744PowerProcessProcess()
      case "Season634603PowerCreepProcess":
        return this.launchSeason634603PowerCreepProcess()
      case "Season701205PowerHarvesterSwampRunnerProcess":
        return this.launchSeason701205PowerHarvesterSwampRunnerProcess()
      case "Season989041MovePowerCreepProcess":
        return this.launchSeason989041MovePowerCreepProcess()
      case "BuyPixelProcess":
        return this.launchBuyPixelProcess()
      case "Season1143119LabChargerProcess":
        return this.launchSeason1143119LabChargerProcess()
      case "Season1200082SendMineralProcess":
        return this.launchSeason1200082SendMineralProcess()
      case "GuardRemoteRoomProcess":
        return this.launchGuardRemoteRoomProcess()
      case "Season1349943DisturbPowerHarvestingProcess":
        return this.launchSeason1349943DisturbPowerHarvestingProcess()
      case "Season1521073SendResourceProcess":
        return this.launchSeason1521073SendResourceProcess()
      case "Season1244215GenericDismantleProcess":
        return this.launchSeason1244215GenericDismantleProcess()
      case "Season1606052SKHarvesterProcess":
        return this.launchSeason1606052SKHarvesterProcess()
      case "UpgradePowerCreepProcess":
        return this.launchUpgradePowerCreepProcess()
      case "Season1655635SKMineralHarvestProcess":
        return this.launchSeason1655635SKMineralHarvestProcess()
      case "Season4332399SKMineralHarvestProcess":
        return this.launchSeason4332399SKMineralHarvestProcess()
      case "Season1838855DistributorProcess":
        return this.launchSeason1838855DistributorProcess()
      case "StealResourceProcess":
        return this.launchStealResourceProcess()
      case "Season2055924SendResourcesProcess":
        return this.launchSeason2055924SendResourcesProcess()
      case "InterRoomResourceManagementProcess":
        return this.launchInterRoomResourceManagementProcess()
      case "World35440623DowngradeControllerProcess":
        return this.launchWorld35440623DowngradeControllerProcess()
      case "ObserveRoomProcess":
        return this.launchObserveRoomProcess()
      case "World35587255ScoutRoomProcess":
        return this.launchWorld35587255ScoutRoomProcess()
      case "World35872159TestDeclarationProcess":
        return this.launchWorld35872159TestDeclarationProcess()
      case "World35872159TestResourcePoolProcess":
        return this.launchWorld35872159TestResourcePoolProcess()
      case "SubmoduleTestProcess":
        return this.launchSubmoduleTestProcess()
      case "ConstructionSaboteurProcess":
        return this.launchConstructionSaboteurProcess()
      case "AttackRoomProcess":
        return this.launchAttackRoomProcess()
      case "MonitoringProcess":
        return this.launchMonitoringProcess()
      case "QuadMakerProcess":
        return this.launchQuadMakerProcess()
      case "Season4275982HarvestCommodityProcess":
        return this.launchSeason4275982HarvestCommodityProcess()
      default: {
        const stringArgument = new KeywardArguments(args)
        return ProcessLauncher.launch(processType, stringArgument)
      }
      }
    })()

    switch (result.resultType) {
    case "succeeded": {
      const detail = ""
      if (this.options.get("-l") != null) {
        Memory.os.logger.filteringProcessIds.push(result.value.processId)
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

  private parseInt(args: Map<string, string>, argumentName: string): number | string {
    const rawValue = args.get(argumentName)
    if (rawValue == null) {
      return `Missing ${argumentName} argument`
    }
    const value = parseInt(rawValue, 10)
    if (isNaN(value) === true) {
      return `${argumentName} is not a number ${rawValue}`
    }
    return value
  }

  private missingArgumentError(argumentName: string): ResultFailed<string> {
    return Result.Failed(`Missing ${argumentName} argument`)
  }

  // ---- Launcher ---- //
  private launchTestProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(null, processId => {
      return TestProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchTestChildProcess(): LaunchCommandResult {
    const rawParentProcessId = this.args[1]
    if (rawParentProcessId == null) {
      return Result.Failed("Missing parent process ID")
    }
    const parentProcessId = parseInt(rawParentProcessId, 10)
    if (isNaN(parentProcessId) === true) {
      return Result.Failed(`Parent process ID is not a number ${rawParentProcessId}`)
    }
    const parentProcess = OperatingSystem.os.processOf(parentProcessId)
    if (parentProcess == null) {
      return Result.Failed(`No process ${parentProcessId}`)
    }
    if (!(parentProcess instanceof TestProcess)) {
      return Result.Failed(`Parent process ${parentProcessId} is not TestProcess`)
    }

    const process = OperatingSystem.os.addProcess(parentProcessId, processId => {
      return TestChildProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchQuad(): LaunchCommandResult {
    return launchQuadProcess(this.parseProcessArguments())
  }

  private launchSeason487837AttackInvaderCoreProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season487837AttackInvaderCoreProcess.create(processId)
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
    const rawNumberOfCreeps = args.get("creeps")
    if (rawNumberOfCreeps == null) {
      return this.missingArgumentError("creeps")
    }
    const numberOfCreeps = parseInt(rawNumberOfCreeps, 10)
    if (isNaN(numberOfCreeps) === true) {
      return Result.Failed(`creeps is not a number ${rawNumberOfCreeps}`)
    }

    const waypoints: RoomName[] = []
    const rawWaypoints = args.get("waypoints")
    if (rawWaypoints == null) {
      const storedValue = GameMap.getWaypoints(roomName, targetRoomName)
      if (storedValue == null) {
        return this.missingArgumentError("waypoints")
      }
      waypoints.push(...storedValue)

    } else {
      const parsedValue = rawWaypoints.split(",")

      const result = GameMap.setWaypoints(roomName, targetRoomName, parsedValue)
      if (result.resultType === "failed") {
        return Result.Failed(`Invalid room names: ${result.reason.invalidRoomNames.join(",")}`)
      }

      waypoints.push(...parsedValue)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season570208DismantleRcl2RoomProcess.create(processId, roomName, targetRoomName, waypoints, numberOfCreeps)
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

    const process = OperatingSystem.os.addProcess(null, processId => {
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

    const process = OperatingSystem.os.addProcess(null, processId => {
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

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season701205PowerHarvesterSwampRunnerProcess.create(processId, roomName, targetRoomName, waypoints, neighbourCount)
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

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season989041MovePowerCreepProcess.create(processId, fromRoomName, toRoomName, waypoints, powerCreepName)
    })
    return Result.Succeeded(process)
  }

  private launchBuyPixelProcess(): LaunchCommandResult {
    if (Environment.world !== "persistent world") {
      return Result.Failed(`Environment ${Environment.world} does not support pixel`)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return BuyPixelProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1143119LabChargerProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const rawLabIds = args.get("labs")
    if (rawLabIds == null) {
      return this.missingArgumentError("labs")
    }
    const labStates: Season1143119LabChargerProcessLabInfo[] = []
    for (const rawLabInfo of rawLabIds.split(",")) {
      const [labId, boost] = rawLabInfo.split(":")
      if (labId == null || boost == null) {
        return Result.Failed(`Invalid labs format lab ID:${labId}, boost: ${boost} (${rawLabIds})`)
      }
      const lab = Game.getObjectById(labId)
      if (!(lab instanceof StructureLab)) {
        return Result.Failed(`${lab} is not StructureLab`)
      }
      if (lab.room.name !== roomName) {
        return Result.Failed(`${lab} is not in ${roomLink(roomName)} (${roomLink(lab.room.name)})`)
      }
      if (!isMineralBoostConstant(boost)) {
        return Result.Failed(`${boost} is not MineralBoostConstant`)
      }
      labStates.push({
        lab,
        boost,
      })
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season1143119LabChargerProcess.create(processId, roomName, labStates)
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

    const process = OperatingSystem.os.addProcess(null, processId => {
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
    const rawMaxBodyCount = args.get("max_body_count")
    if (rawMaxBodyCount == null) {
      return this.missingArgumentError("max_body_count")
    }
    const maxBodyCount = parseInt(rawMaxBodyCount, 10)
    if (isNaN(maxBodyCount) === true) {
      return Result.Failed(`max_body_count is not a number ${maxBodyCount}`)
    }
    const targetId = args.get("target_id")
    if (targetId == null) {
      return this.missingArgumentError("target_id")
    }

    const waypoints: RoomName[] = []
    const rawWaypoints = args.get("waypoints")
    if (rawWaypoints == null) {
      const storedValue = GameMap.getWaypoints(roomName, targetRoomName)
      if (storedValue == null) {
        return this.missingArgumentError("waypoints")
      }
      waypoints.push(...storedValue)

    } else {
      const parsedValue = rawWaypoints.split(",")

      const result = GameMap.setWaypoints(roomName, targetRoomName, parsedValue)
      if (result.resultType === "failed") {
        return Result.Failed(`Invalid room names: ${result.reason.invalidRoomNames.join(",")}`)
      }

      waypoints.push(...parsedValue)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season1244215GenericDismantleProcess.create(processId, roomName, targetRoomName, waypoints, targetId as Id<AnyStructure>, maxBodyCount)
    })
    return Result.Succeeded(process)
  }

  private launchGuardRemoteRoomProcess(): LaunchCommandResult {
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
    const rawNumberOfCreeps = args.get("creeps")
    if (rawNumberOfCreeps == null) {
      return this.missingArgumentError("creeps")
    }
    const numberOfCreeps = parseInt(rawNumberOfCreeps, 10)
    if (isNaN(numberOfCreeps) === true) {
      return Result.Failed(`creeps is not a number ${rawNumberOfCreeps}`)
    }
    const creepType = args.get("creep_type")
    if (creepType == null) {
      return this.missingArgumentError("creep_type")
    }
    if (!isGuardRemoteRoomProcessCreepType(creepType)) {
      return Result.Failed(`Invalid creep type ${creepType}, options: ${GuardRemoteRoomProcessCreepType}`)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return GuardRemoteRoomProcess.create(processId, roomName, targetRoomName, waypoints, creepType, numberOfCreeps)
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

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season1349943DisturbPowerHarvestingProcess.create(processId, roomName, waypoints, patrolRooms, attackerType as ("attacker" | "ranged_attacker" | "large_ranged_attacker"))
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
    const rawFinishWorking = args.get("finish_working")
    if (rawFinishWorking == null) {
      return this.missingArgumentError("finish_working")
    }
    const finishWorking = parseInt(rawFinishWorking, 10)
    if (isNaN(finishWorking) === true) {
      return Result.Failed(`finish_working is not a number ${rawFinishWorking}`)
    }
    const rawNumberOfCreeps = args.get("creeps")
    if (rawNumberOfCreeps == null) {
      return this.missingArgumentError("creeps")
    }
    const numberOfCreeps = parseInt(rawNumberOfCreeps, 10)
    if (isNaN(numberOfCreeps) === true) {
      return Result.Failed(`creeps is not a number ${rawNumberOfCreeps}`)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season1521073SendResourceProcess.create(processId, roomName, targetRoomName, waypoints, finishWorking, numberOfCreeps)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1606052SKHarvesterProcess(): LaunchCommandResult {
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

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season1606052SKHarvesterProcess.create(processId, roomName, targetRoomName, waypoints, false)
    })
    return Result.Succeeded(process)
  }

  private launchUpgradePowerCreepProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(null, processId => {
      return UpgradePowerCreepProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1655635SKMineralHarvestProcess(): LaunchCommandResult {
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

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season1655635SKMineralHarvestProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason4332399SKMineralHarvestProcess(): LaunchCommandResult {
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

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season4332399SKMineralHarvestProcess.create(processId, roomName, targetRoomName, waypoints)
    })
    return Result.Succeeded(process)
  }

  private launchSeason1838855DistributorProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season1838855DistributorProcess.create(processId, roomName)
    })
    return Result.Succeeded(process)
  }

  private launchStealResourceProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }
    const targetId = args.get("target_id")
    if (targetId == null) {
      return this.missingArgumentError("target_id")
    }
    const rawFinishWorking = args.get("finish_working")
    if (rawFinishWorking == null) {
      return this.missingArgumentError("finish_working")
    }
    const finishWorking = parseInt(rawFinishWorking, 10)
    if (isNaN(finishWorking) === true) {
      return Result.Failed(`finish_working is not a number ${rawFinishWorking}`)
    }
    const rawNumberOfCreeps = args.get("creeps")
    if (rawNumberOfCreeps == null) {
      return this.missingArgumentError("creeps")
    }
    const numberOfCreeps = parseInt(rawNumberOfCreeps, 10)
    if (isNaN(numberOfCreeps) === true) {
      return Result.Failed(`creeps is not a number ${rawNumberOfCreeps}`)
    }

    const waypoints: RoomName[] = []
    const rawWaypoints = args.get("waypoints")
    if (rawWaypoints == null) {
      const storedValue = GameMap.getWaypoints(roomName, targetRoomName)
      if (storedValue == null) {
        return this.missingArgumentError("waypoints")
      }
      waypoints.push(...storedValue)

    } else {
      const parsedValue = rawWaypoints.split(",")

      const result = GameMap.setWaypoints(roomName, targetRoomName, parsedValue)
      if (result.resultType === "failed") {
        return Result.Failed(`Invalid room names: ${result.reason.invalidRoomNames.join(",")}`)
      }

      waypoints.push(...parsedValue)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return StealResourceProcess.create(processId, roomName, targetRoomName, waypoints, targetId as Id<StructureStorage>, true, numberOfCreeps, finishWorking)
    })
    return Result.Succeeded(process)
  }

  private launchSeason2055924SendResourcesProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const rawSectorNames = args.get("target_sector_names")
    const sectorNames: SectorName[] | null = rawSectorNames != null ? rawSectorNames.split(",") : null
    const rawExcludedResourceType = args.get("excluded_resource_types")
    const excludedResourceTypes = ((): ResourceConstant[] | string => {
      if (rawExcludedResourceType == null) {
        return []
      }
      const resourceTypes = rawExcludedResourceType.split(",")
      const invalidResourceType = resourceTypes.find(resourceType => !isResourceConstant(resourceType))
      if (invalidResourceType != null) {
        return `Invalid resource type ${invalidResourceType}`
      }
      return resourceTypes as ResourceConstant[]
    })()

    if (typeof excludedResourceTypes === "string") {
      return Result.Failed(excludedResourceTypes)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season2055924SendResourcesProcess.create(processId, roomName, sectorNames, excludedResourceTypes)
    })
    return Result.Succeeded(process)
  }

  private launchInterRoomResourceManagementProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(null, processId => {
      return InterRoomResourceManagementProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchWorld35440623DowngradeControllerProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const rawTargetRoomNames = args.get("target_room_names")
    if (rawTargetRoomNames == null) {
      return this.missingArgumentError("target_room_names")
    }
    const targetRoomNames = rawTargetRoomNames.split(",")

    const rawMaxClaimSize = args.get("max_claim_size")
    if (rawMaxClaimSize == null) {
      return this.missingArgumentError("max_claim_size")
    }
    const maxClaimSize = parseInt(rawMaxClaimSize, 10)
    if (isNaN(maxClaimSize) === true) {
      return Result.Failed(`max_claim_size is not a number ${rawMaxClaimSize}`)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return World35440623DowngradeControllerProcess.create(processId, roomName, targetRoomNames, maxClaimSize)
    })
    return Result.Succeeded(process)
  }

  private launchObserveRoomProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }
    const duration = this.parseInt(args, "duration")
    if (typeof duration === "string") {
      return Result.Failed(duration)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return ObserveRoomProcess.create(processId, roomName, targetRoomName, duration)
    })
    return Result.Succeeded(process)
  }

  private launchWorld35587255ScoutRoomProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return World35587255ScoutRoomProcess.create(processId, roomName)
    })
    return Result.Succeeded(process)
  }

  private launchWorld35872159TestDeclarationProcess(): LaunchCommandResult {

    const process = OperatingSystem.os.addProcess(null, processId => {
      return World35872159TestDeclarationProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchWorld35872159TestResourcePoolProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(null, processId => {
      return World35872159TestResourcePoolProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchSubmoduleTestProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(null, processId => {
      return SubmoduleTestProcess.create(processId)
    })
    return Result.Succeeded(process)
  }

  private launchConstructionSaboteurProcess(): LaunchCommandResult {
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
    const rawNumberOfCreeps = args.get("creeps")
    if (rawNumberOfCreeps == null) {
      return this.missingArgumentError("creeps")
    }
    const numberOfCreeps = parseInt(rawNumberOfCreeps, 10)
    if (isNaN(numberOfCreeps) === true) {
      return Result.Failed(`creeps is not a number ${rawNumberOfCreeps}`)
    }

    // const process = OperatingSystem.os.addProcess(null, processId => {
    //   return ConstructionSaboteurProcess.create(processId, roomName, targetRoomName, )
    // })
    // return Result.Succeeded(process)
    return Result.Failed("not implemented yet")
  }

  private launchAttackRoomProcess(): LaunchCommandResult {
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
    const rawNumberOfCreeps = args.get("creeps")
    if (rawNumberOfCreeps == null) {
      return this.missingArgumentError("creeps")
    }
    const numberOfCreeps = parseInt(rawNumberOfCreeps, 10)
    if (isNaN(numberOfCreeps) === true) {
      return Result.Failed(`creeps is not a number ${rawNumberOfCreeps}`)
    }

    // const process = OperatingSystem.os.addProcess(null, processId => {
    //   return AttackRoomProcess.create(processId, roomName, targetRoomName, )
    // })
    // return Result.Succeeded(process)
    return Result.Failed("not implemented yet")
  }

  private launchMonitoringProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const name = args.get("name")
    if (name == null) {
      return this.missingArgumentError("name")
    }

    const target = ((): MonitoringTarget | string => {
      const roomName = args.get("room_name")
      if (roomName != null) {
        const room = Game.rooms[roomName]
        if (room?.controller?.my === true) {
          const ownedRoomTarget: MonitoringTargetOwnedRoom = {
            case: "owned room",
            roomName,
            conditions: [],
          }
          return ownedRoomTarget
        }

        const hostileRoomTarget: MonitoringTargetHostileRoom = {
          case: "hostile room",
          roomName,
          conditions: [],
        }
        return hostileRoomTarget
      }
      return "Cannot determine monitoring target. Specify one of (room_name, )"
    })()

    if (typeof target === "string") {
      return Result.Failed(target)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return MonitoringProcess.create(processId, name, target)
    })
    return Result.Succeeded(process)
  }

  private launchQuadMakerProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const name = args.get("name")
    if (name == null) {
      return this.missingArgumentError("name")
    }
    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return QuadMakerProcess.create(processId, name, roomName, targetRoomName)
    })
    return Result.Succeeded(process)
  }

  private launchSeason4275982HarvestCommodityProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const targetRoomName = args.get("target_room_name")
    if (targetRoomName == null) {
      return this.missingArgumentError("target_room_name")
    }
    const commodityType = args.get("commodity_type")
    if (commodityType == null) {
      return this.missingArgumentError("commodity_type")
    }
    if (!isDepositConstant(commodityType)) {
      return Result.Failed(`${commodityType} is not commodity type`)
    }

    const rawHarvesterCount = args.get("harvester_count")
    if (rawHarvesterCount == null) {
      return this.missingArgumentError("harvester_count")
    }
    const harvesterCount = parseInt(rawHarvesterCount, 10)
    if (isNaN(harvesterCount) === true) {
      return Result.Failed(`harvester_count ${rawHarvesterCount} is not a number`)
    }

    const roomDistance = Game.map.getRoomLinearDistance(roomName, targetRoomName)
    const haulerCount = roomDistance >= 3 ? 2 : 1

    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season4275982HarvestCommodityProcess.create(
        processId,
        roomName,
        {
          roomName: targetRoomName,
          commodityType,
          neighbourCellCount: 1,  // FixMe:
          currentCooldown: 0,
        },
        {
          harvesterCount: harvesterCount,
          haulerCount,
        }
      )
    })
    return Result.Succeeded(process)
  }
}

/**
 * const roomName = args.string()
 * args.parse((roomName, targetRoomName) => {
 * },
 * error => {
 * })
 */

// class Arg<T> {
//   public parseString(key: string):
// }

// function parseRoomName(key: string): string {
//   throw
// }

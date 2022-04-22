import { Process } from "process/process"
import { TestChildProcess, TestProcess } from "process/test/test_process"
import { OperatingSystem } from "os/os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { Result, ResultFailed } from "utility/result"
import { Season487837AttackInvaderCoreProcess } from "process/temporary/season_487837_attack_invader_core_process"
import { Season570208DismantleRcl2RoomProcess } from "process/temporary/season_570208_dismantle_rcl2_room_process"
import { PowerProcessProcess } from "process/process/power_creep/power_process_process"
import { roomLink } from "utility/log"
import { PowerCreepProcess } from "process/process/power_creep/power_creep_process"
import { MovePowerCreepProcess } from "process/process/power_creep/move_power_creep_process"
import { BuyPixelProcess } from "process/process/buy_pixel_process"
import { Environment } from "utility/environment"
import { Season1200082SendMineralProcess } from "process/temporary/season_1200082_send_mineral_process"
import { Season1244215GenericDismantleProcess } from "process/temporary/season_1244215_generic_dismantle_process"
import { isGuardRemoteRoomProcessCreepType, GuardRemoteRoomProcess } from "process/process/guard_remote_room_process"
import { Season1349943DisturbPowerHarvestingProcess } from "process/temporary/season_1349943_disturb_power_harvesting_process"
import { Season1521073SendResourceProcess } from "process/temporary/season_1521073_send_resource_process"
import { Season1606052SKHarvesterProcess } from "process/temporary/season_1606052_sk_harvester_process"
import { isResourceConstant } from "utility/resource"
import { UpgradePowerCreepProcess } from "process/process/power_creep/upgrade_power_creep_process"
import { Season1655635SKMineralHarvestProcess } from "process/temporary/season_1655635_sk_mineral_harvest_process"
import { DistributorProcess } from "process/process/distributor_process"
import { StealResourceProcess } from "process/onetime/steal_resource_process"
import { Season2055924SendResourcesProcess } from "process/temporary/season_2055924_send_resources_process"
import { InterRoomResourceManagementProcess } from "process/process/inter_room_resource_management_process"
import { World35440623DowngradeControllerProcess } from "process/temporary/world_35440623_downgrade_controller_process"
import { ObserveRoomProcess } from "process/process/observe_room_process"
import { World35587255ScoutRoomProcess } from "process/temporary/world_35587255_scout_room_process"
import { World35872159TestDeclarationProcess } from "process/temporary/world_35872159_test_declaration_process"
import { World35872159TestResourcePoolProcess } from "process/temporary/world_35872159_test_resource_pool_process"
import { SectorName } from "utility/room_sector"
import { launchQuadProcess } from "process/onetime/submodule_process_launcher"
import { SubmoduleTestProcess } from "../../../../submodules/private/submodule_test_process"
import { MonitoringProcess, Target as MonitoringTarget, TargetHostileRoom as MonitoringTargetHostileRoom, TargetOwnedRoom as MonitoringTargetOwnedRoom } from "process/onetime/monitoring_process"
import { QuadMakerProcess } from "process/onetime/quad_maker/quad_maker_process"
import { GameMap } from "game/game_map"
import { RoomCoordinate, RoomName } from "utility/room_name"
import { Season4332399SKMineralHarvestProcess } from "process/temporary/season4_332399_sk_mineral_harvest_process"
import { HarvestCommodityProcess } from "process/onetime/harvest_commodity_process"
import { ProduceCommodityProcess } from "process/process/produce_commodity_process"
import { ProcessLauncher } from "process/process_launcher"
import { KeywordArguments } from "./utility/keyword_argument_parser"
import { DefenseRoomProcess } from "process/process/defense/defense_room_process"
import { GclFarmManagerProcess } from "process/process/gcl_farm/gcl_farm_manager_process"
import { Season4784484ScoreProcess } from "process/temporary/season4_784484_score_process"
import { directionName } from "utility/direction"
import { DefenseRemoteRoomProcess } from "process/process/defense_remote_room_process"
import { HarvestPowerProcess } from "process/onetime/harvest_power_process"
import { HighwayProcessLauncherProcess } from "process/process/highway_process_launcher_process"
import { World39013108CollectResourceProcess } from "process/temporary/world_39013108_collect_resource_process"
import { Season41076620ResourceManagerProcess } from "process/temporary/season4_1076620_resource_manager_process"
import { ContinuouslyProduceCommodityProcess } from "process/process/continuously_produce_commodity_process"
import { Season4ScoreLauncherProcess } from "process/temporary/season4_score_launcher_process"
import { isWithdrawStructureProcessTargetType, WithdrawStructureProcess, WithdrawStructureProcessTargetType } from "process/onetime/withdraw_structure_process"
import { Season4TravelerTestProcess } from "process/temporary/season4_traveler_test_process"
import { Season4OperateExtraLinkProcess } from "process/temporary/season4_operate_extra_link_process"
import { BoostLabChargerProcess } from "process/process/boost_lab_charger_process"
import { SignProcess, SignProcessSign } from "process/onetime/sign_process"
import { AttackRoomProcess } from "process/onetime/attack/attack_room_process"
import { DraftingRoomProcess } from "process/onetime/attack/drafting_room_process"
import { AggressiveClaimProcess } from "process/onetime/attack/aggressive_claim_process"
import { RoomResources } from "room_resource/room_resources"
import { } from "../../../../submodules/private/attack/planning/claimed_room_attack_planner_process"
import { } from "process/onetime/saboteur/active_saboteur_process"
import { } from "process/onetime/saboteur/passive_saboteur_process"
import {} from "process/onetime/self_aware_creep_process"
import { ProblemSolverV1, ProblemSolverV1Process } from "process/onetime/problem_solver_v1_process"
import { GameConstants } from "utility/constants"
import { SendEnergyToAllyProcess } from "process/onetime/send_energy_to_ally_process"

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
      case "BuyPixelProcess":
        return this.launchBuyPixelProcess()
      case "Season1200082SendMineralProcess":
        return this.launchSeason1200082SendMineralProcess()
      case "Season1349943DisturbPowerHarvestingProcess":
        return this.launchSeason1349943DisturbPowerHarvestingProcess()
      case "Season1606052SKHarvesterProcess":
        return this.launchSeason1606052SKHarvesterProcess()
      case "UpgradePowerCreepProcess":
        return this.launchUpgradePowerCreepProcess()
      case "Season1655635SKMineralHarvestProcess":
        return this.launchSeason1655635SKMineralHarvestProcess()
      case "Season4332399SKMineralHarvestProcess":
        return this.launchSeason4332399SKMineralHarvestProcess()
      case "DistributorProcess":
        return this.launchDistributorProcess()
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
      case "MonitoringProcess":
        return this.launchMonitoringProcess()
      case "QuadMakerProcess":
        return this.launchQuadMakerProcess()
      default: {
        const stringArgument = new KeywordArguments(args)
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

  private launchBuyPixelProcess(): LaunchCommandResult {
    if (Environment.world !== "persistent world") {
      return Result.Failed(`Environment ${Environment.world} does not support pixel`)
    }

    const process = OperatingSystem.os.addProcess(null, processId => {
      return BuyPixelProcess.create(processId)
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

  private launchDistributorProcess(): LaunchCommandResult {
    const args = this.parseProcessArguments()

    const roomName = args.get("room_name")
    if (roomName == null) {
      return this.missingArgumentError("room_name")
    }
    const process = OperatingSystem.os.addProcess(null, processId => {
      return DistributorProcess.create(processId, roomName)
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
}

/** @throws */
const getWaypoints = (keywordArguments: KeywordArguments, roomName: RoomName, targetRoomName: RoomName): RoomName[] => {
  const waypointsArgument = keywordArguments.roomNameList("waypoints").parseOptional()
  if (waypointsArgument != null) {
    if (GameMap.hasWaypoints(roomName, targetRoomName) !== true) {
      GameMap.setWaypoints(roomName, targetRoomName, waypointsArgument)
    }
    return waypointsArgument
  }
  const stored = GameMap.getWaypoints(roomName, targetRoomName, { ignoreMissingWaypoints: true })
  if (stored == null) {
    throw `waypoints not given and waypoints from ${roomLink(roomName)} to ${roomLink(targetRoomName)} is not stored`
  }
  return stored
}

ProcessLauncher.register("ProduceCommodityProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})
    const room = Game.rooms[roomName]
    if (room == null || room.controller?.my !== true) {
      throw `${roomLink(roomName)} is not mine`
    }

    const factory = (room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_FACTORY } }) as StructureFactory[])[0]
    if (factory == null) {
      throw `${roomLink(roomName)} has no factory`
    }

    return Result.Succeeded((processId) => ProduceCommodityProcess.create(processId, roomName, factory.id))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("DefenseRoomProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })

    return Result.Succeeded((processId) => DefenseRoomProcess.create(processId, roomName))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("GclFarmManagerProcess", args => {
  try {
    const name = args.string("name").parse()

    return Result.Succeeded((processId) => GclFarmManagerProcess.create(processId, name))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("HarvestCommodityProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const depositType = args.depositType("deposit_type").parse()
    const depositId = args.gameObjectId("deposit_id").parse() as Id<Deposit>
    const harvesterCount = args.int("harvester_count").parse({max: 4})
    const haulerCount = 1

    return Result.Succeeded((processId) => HarvestCommodityProcess.create(
      processId,
      roomName,
      {
        roomName: targetRoomName,
        commodityType: depositType,
        depositId,
        neighbourCellCount: 1,  // FixMe:
        currentCooldown: 0,
      },
      {
        harvesterCount: harvesterCount,
        haulerCount,
      }
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season4784484ScoreProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const highwayEntranceRoomName = args.roomName("highway_entrance_room_name").parse()
    const highwayEntranceRoomCoordinate = RoomCoordinate.parse(highwayEntranceRoomName)
    if (highwayEntranceRoomCoordinate == null) {
      throw `cannot parse highway entrance room name ${roomLink(highwayEntranceRoomName)}`
    }
    if (highwayEntranceRoomCoordinate.roomType !== "highway") {
      throw `highway_entrance_room_name is not on a highway ${roomLink(highwayEntranceRoomName)} (${highwayEntranceRoomCoordinate.roomType})`
    }

    const direction = ((): TOP | BOTTOM | LEFT | RIGHT => {
      const missingArgumentErrorMessage = "missing direction argument: set direction the scoring creep heads toward"
      const value = args.direction("direction", {missingArgumentErrorMessage}).parse()
      if (value === TOP || value === BOTTOM || value === LEFT || value === RIGHT) {
        return value
      }
      throw `invalid diagonal direction ${directionName(value)} (${value})`
    })()

    const nextHighwayRoom = highwayEntranceRoomCoordinate.neighbourRoom(direction)
    const nextHighwayRoomCoordinate = RoomCoordinate.parse(nextHighwayRoom)
    if (nextHighwayRoomCoordinate == null) {
      throw `cannot parse room next to the entrance room ${roomLink(nextHighwayRoom)}`
    }
    switch (nextHighwayRoomCoordinate.roomType) {
    case "highway":
    case "highway_crossing":
      break
    case "normal":
    case "source_keeper":
    case "sector_center":
      throw `room next to the entrance room ${roomLink(nextHighwayRoom)} is not on a highway ${nextHighwayRoomCoordinate?.roomType}`
    }

    const convoyCreepId = args.gameObjectId("convoy_creep_id").parse() as Id<Creep>
    const estimatedDespawnTime = Game.time + 1000
    const commodityType = args.commodityType("commodity_type").parse()
    const amount = args.int("amount").parse({min: 1, max: 999})
    const dryRun = args.boolean("dry_run").parseOptional() ?? false

    return Result.Succeeded((processId) => Season4784484ScoreProcess.create(
      processId,
      roomName,
      highwayEntranceRoomName,
      direction,
      commodityType,
      amount,
      convoyCreepId,
      estimatedDespawnTime,
      {
        dryRun,
      },
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("DefenseRemoteRoomProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})

    return Result.Succeeded((processId) => DefenseRemoteRoomProcess.create(processId, roomName))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("HarvestPowerProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const neighbourCount = args.int("neighbour_count").parse({ min: 1, max: 8 })
    const position = args.localPosition("position").parse()
    const powerAmount = args.int("power_amount").parse()
    const powerBankId = args.gameObjectId("power_bank_id").parse() as Id<StructurePowerBank>
    const waypoints = GameMap.getWaypoints(roomName, targetRoomName) ?? []

    const powerBankInfo = {
      id: powerBankId,
      powerAmount,
      position,
      neighbourCount,
    }

    return Result.Succeeded((processId) => HarvestPowerProcess.create(processId, roomName, targetRoomName, waypoints, powerBankInfo))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("MovePowerCreepProcess", args => {
  try {
    const fromRoomName = args.roomName("from_room_name").parse({ my: true })
    const toRoomName = args.roomName("to_room_name").parse({my: true})
    const waypoints = args.roomNameList("waypoints").parse()
    const powerCreep = args.powerCreep("power_creep_name").parse()

    return Result.Succeeded((processId) => MovePowerCreepProcess.create(processId, fromRoomName, toRoomName, waypoints, powerCreep.name))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("PowerCreepProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const powerCreep = args.powerCreep("power_creep_name").parse()

    return Result.Succeeded((processId) => PowerCreepProcess.create(processId, roomName, powerCreep.name))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("PowerProcessProcess", args => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()
    const powerSpawn = roomResource.activeStructures.powerSpawn
    if (powerSpawn == null) {
      throw `no power spawn in ${roomLink(roomResource.room.name)}`
    }

    return Result.Succeeded((processId) => PowerProcessProcess.create(processId, roomResource.room.name, powerSpawn.id))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("HighwayProcessLauncherProcess", () => {
  try {
    return Result.Succeeded((processId) => HighwayProcessLauncherProcess.create(processId))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("World39013108CollectResourceProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const resourceType = args.resourceType("resource_type").parse()
    const amount = args.int("amount").parse({ min: 100, max: 100000 })
    const interval = args.int("interval").parse({min: 0})

    return Result.Succeeded((processId) => World39013108CollectResourceProcess.create(processId, roomName, resourceType, amount, interval))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("GuardRemoteRoomProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()

    const waypoints = ((): RoomName[] => {
      const waypointsArgument = args.roomNameList("waypoints").parseOptional()
      if (waypointsArgument != null) {
        if (GameMap.hasWaypoints(roomName, targetRoomName) !== true) {
          GameMap.setWaypoints(roomName, targetRoomName, waypointsArgument)
        }
        return waypointsArgument
      }
      const stored = GameMap.getWaypoints(roomName, targetRoomName, { ignoreMissingWaypoints: true })
      if (stored == null) {
        throw `waypoints not given and waypoints from ${roomLink(roomName)} to ${roomLink(targetRoomName)} is not stored`
      }
      return stored
    })()

    const creepType = args.typedString("creep_type", "GuardRemoteRoomProcessCreepType", isGuardRemoteRoomProcessCreepType).parse()
    const creepCount = args.int("creep_count").parse({min: 1, max: 5})

    return Result.Succeeded((processId) => GuardRemoteRoomProcess.create(processId, roomName, targetRoomName, waypoints, creepType, creepCount))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("ContinuouslyProduceCommodityProcess", args => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
    const factory = roomResource.activeStructures.factory
    if (factory == null) {
      throw `no factory in ${roomLink(roomName)}`
    }

    return Result.Succeeded((processId) => ContinuouslyProduceCommodityProcess.create(processId, roomName, factory))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season41076620ResourceManagerProcess", () => {
  try {
    return Result.Succeeded((processId) => Season41076620ResourceManagerProcess.create(processId))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season4ScoreLauncherProcess", () => {
  try {
    return Result.Succeeded((processId) => Season4ScoreLauncherProcess.create(processId))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("WithdrawStructureProcess", args => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
    if (roomResource.activeStructures.terminal == null && roomResource.activeStructures.storage == null) {
      throw `${roomLink(roomName)} has no terminal nor storage`
    }

    const targetStructureIds = args.list("target_ids", "object_id").parse() as Id<WithdrawStructureProcessTargetType>[]
    targetStructureIds.forEach(structureId => {
      const structure = Game.getObjectById(structureId)
      if (structure == null) {
        throw `structure for ID ${structureId} does not exist`
      }
      if (structure.room.name !== roomName) {
        throw `structure ${structure} is not in ${roomLink(roomName)} (in ${roomLink(structure.room.name)})`
      }
      if (!(isWithdrawStructureProcessTargetType(structure))) {
        throw `structure ${structure} is not expected type`
      }
    })

    return Result.Succeeded((processId) => WithdrawStructureProcess.create(processId, roomName, targetStructureIds))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season4TravelerTestProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})

    return Result.Succeeded((processId) => Season4TravelerTestProcess.create(processId, roomName))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season4OperateExtraLinkProcess", args => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
    if ((roomResource.roomInfo.config?.extraLinkIds?.length ?? 0) <= 0) {
      throw `${roomLink(roomName)} doesn't have extra links`
    }

    const upgraderLink = args.visibleGameObject("upgrader_link_id").parse({inRoomName: roomName})
    if (!(upgraderLink instanceof StructureLink)) {
      throw `${upgraderLink} is not StructureLink`
    }

    return Result.Succeeded((processId) => Season4OperateExtraLinkProcess.create(processId, roomName, upgraderLink.id))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("BoostLabChargerProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})

    return Result.Succeeded((processId) => BoostLabChargerProcess.create(processId, roomName))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("SignProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parseOptional() ?? roomName

    const sign = ((): SignProcessSign => {
      const targetRoom = Game.rooms[targetRoomName]
      if (targetRoom != null && targetRoom.controller?.my === true) {
        const sign = args.string("sign").parseOptional()
        if (sign != null) {
          return {
            case: "my room",
            sign,
          }
        }
        return {
          case: "my room",
        }
      }

      const sign = args.string("sign").parse()
      return {
        case: "normal",
        sign,
      }
    })()

    return Result.Succeeded((processId) => SignProcess.create(processId, roomName, targetRoomName, sign))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("AttackRoomProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()

    if (GameMap.hasWaypoints(roomName, targetRoomName) !== true) {
      const calculated = GameMap.calculateSafeWaypoints(roomName, targetRoomName)
      if (calculated == null) {
        throw `waypoint not set between ${roomLink(roomName)} to ${roomLink(targetRoomName)}`
      }
      GameMap.setWaypoints(roomName, targetRoomName, calculated)
    }

    return Result.Succeeded((processId) => AttackRoomProcess.create(processId, roomName, targetRoomName))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("DraftingRoomProcess", args => {
  try {
    const observer = args.visibleGameObject("observer_id").parse()
    if (!(observer instanceof StructureObserver)) {
      throw `${observer} is not StructureObserver`
    }
    const roomCoordinate = observer.room.coordinate
    const dryRun = args.boolean("dry_run").parseOptional() ?? true

    return Result.Succeeded((processId) => DraftingRoomProcess.create(processId, observer, roomCoordinate, dryRun))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("AggressiveClaimProcess", args => {
  try {
    const claimableRoomCount = RoomResources.getClaimableRoomCount()
    if (claimableRoomCount <= 0) {
      throw `${Environment.description} no claimable rooms`
    }

    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const blockingWallIds = args.list("blocking_wall_ids", "object_id").parse() as Id<StructureWall | StructureRampart>[]
    const excludeStructureIds = args.list("excluded_structure_ids", "object_id").parse() as Id<AnyStructure>[]

    return Result.Succeeded((processId) => AggressiveClaimProcess.create(processId, roomName, targetRoomName, blockingWallIds, excludeStructureIds))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("ProblemSolver", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const problem = ProblemSolverV1.createTestProblem()

    return Result.Succeeded((processId) => ProblemSolverV1Process.create(processId, roomName, problem))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season1244215GenericDismantleProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()

    const waypoints = ((): RoomName[] => {
      const waypointsArgument = args.roomNameList("waypoints").parseOptional()
      if (waypointsArgument != null) {
        if (GameMap.hasWaypoints(roomName, targetRoomName) !== true) {
          GameMap.setWaypoints(roomName, targetRoomName, waypointsArgument)
        }
        return waypointsArgument
      }
      const stored = GameMap.getWaypoints(roomName, targetRoomName, { ignoreMissingWaypoints: true })
      if (stored == null) {
        throw `waypoints not given and waypoints from ${roomLink(roomName)} to ${roomLink(targetRoomName)} is not stored`
      }
      return stored
    })()

    const targetId = args.gameObjectId("target_id").parse()
    const maxBodyCount = args.int("max_body_count").parse({min: 1, max: GameConstants.creep.body.bodyPartMaxCount})

    return Result.Succeeded((processId) => Season1244215GenericDismantleProcess.create(
      processId,
      roomName,
      targetRoomName,
      waypoints,
      targetId as Id<AnyStructure>,
      maxBodyCount
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("SendEnergyToAllyProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const waypoints = getWaypoints(args, roomName, targetRoomName)
    const finishWorking = args.int("finish_working").parse({min: 0, max: GameConstants.creep.life.lifeTime})
    const numberOfCreeps = args.int("creep_count").parse({min: 1})
    const allyRoomEntrancePosition = args.localPosition("room_entrance_position").parse()

    return Result.Succeeded((processId) => SendEnergyToAllyProcess.create(
      processId,
      roomName,
      targetRoomName,
      waypoints,
      finishWorking,
      numberOfCreeps,
      allyRoomEntrancePosition
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season1521073SendResourceProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const waypoints = getWaypoints(args, roomName, targetRoomName)
    const finishWorking = args.int("finish_working").parse({ min: 0, max: GameConstants.creep.life.lifeTime })
    const numberOfCreeps = args.int("creep_count").parse({ min: 1 })

    return Result.Succeeded((processId) => Season1521073SendResourceProcess.create(
      processId,
      roomName,
      targetRoomName,
      waypoints,
      finishWorking,
      numberOfCreeps,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})



import { Process, ProcessId } from "process/process"
import { TestChildProcess, TestProcess } from "process/test/test_process"
import { OperatingSystem } from "os/os"
import { ConsoleCommand, CommandExecutionResult } from "./console_command"
import { Result, ResultFailed } from "shared/utility/result"
import { Season487837AttackInvaderCoreProcess } from "process/temporary/season_487837_attack_invader_core_process"
import { PowerProcessProcess } from "process/process/power_creep/power_process_process"
import { coloredText, roomLink } from "utility/log"
import { PowerCreepProcess } from "process/process/power_creep/power_creep_process"
import { MovePowerCreepProcess } from "process/process/power_creep/move_power_creep_process"
import { PowerCreepStealProcess } from "process/process/power_creep/power_creep_steal_process"
import { BuyPixelProcess } from "process/process/buy_pixel_process"
import { Environment } from "utility/environment"
import { Season1200082SendMineralProcess } from "process/temporary/season_1200082_send_mineral_process"
import { Season1244215GenericDismantleProcess } from "process/temporary/season_1244215_generic_dismantle_process"
import { isGuardRemoteRoomProcessCreepType, GuardRemoteRoomProcess, canSpawnGuardCreep } from "process/process/guard_remote_room_process"
import { Season1349943DisturbPowerHarvestingProcess } from "process/temporary/season_1349943_disturb_power_harvesting_process"
import { Season1606052SKHarvesterProcess } from "process/temporary/season_1606052_sk_harvester_process"
import { isMineralCompoundConstant, isResourceConstant } from "shared/utility/resource"
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
import type { SectorName } from "shared/utility/room_sector_type"
import { SubmoduleTestProcess } from "../../../../submodules/private/submodule_test_process"
import { MonitoringProcess, Target as MonitoringTarget, TargetHostileRoom as MonitoringTargetHostileRoom, TargetOwnedRoom as MonitoringTargetOwnedRoom } from "process/onetime/monitoring_process"
import { QuadMakerProcess } from "process/onetime/quad_maker/quad_maker_process"
import { GameMap } from "game/game_map"
import type { RoomName } from "shared/utility/room_name_types"
import { Season4332399SKMineralHarvestProcess } from "process/temporary/season4_332399_sk_mineral_harvest_process"
import { HarvestCommodityProcess } from "process/onetime/harvest_commodity_process"
import { ProduceCommodityProcess } from "process/process/produce_commodity_process"
import { ProcessLauncher } from "process/process_launcher"
import { KeywordArguments } from "../../../shared/utility/argument_parser/keyword_argument_parser"
import { DefenseRoomProcess } from "process/process/defense/defense_room_process"
import { GclFarmManagerProcess } from "process/process/gcl_farm/gcl_farm_manager_process"
import { Season4784484ScoreProcess } from "process/temporary/season4_784484_score_process"
import { directionName } from "shared/utility/direction"
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
import { DefenseNukeProcess } from "process/onetime/defense_nuke_process"
import { HaulEnergyProcess } from "process/onetime/haul_energy_process"
import { World42768365ProblemSolverProcess } from "process/temporary/world_42768365_problem_solver_process"
import { ClaimProcess } from "process/onetime/claim_process"
import { World42791528ProblemFinderProcess } from "process/temporary/world_42791528_problem_finder_process"
import { MapVisualProcess } from "process/onetime/map_visual_process"
import { RoomCoordinate } from "utility/room_coordinate"
import { SellAllResourcesProcess } from "process/onetime/sell_all_resources_process"
import { LandOccupationProcess } from "process/process/land_occupation/land_occupation_process"
import { BuildableWallTypes, ClusterPlan, LandOccupationStructureTypes, serializePosition } from "process/process/land_occupation/land_occupation_datamodel"
import { decodeRoomPosition, Position, RoomPositionFilteringOptions } from "prototype/room_position"
import { NukerManagementProcess } from "process/onetime/nuke/nuker_management_process"
import { PrimitiveLogger } from "../primitive_logger"
import { isNukerReady, LaunchNukeProcess, NukeTargetInfo } from "process/onetime/nuke/launch_nuke_process"
import { isNukerReady as isConsecutiveNukerReady, ConsecutiveNukeProcess, NukeTargetInfo as ConsecutiveNukeTargetInfo } from "process/onetime/nuke/consecutive_nuke_process"
import { OnHeapDelayProcess } from "process/onetime/on_heap_delay_process"
// import {} from "process/process/declarative/empire_process"
import { } from "process/process/purifier/purifier_process"
import { SaboteurConstructionProcess } from "process/onetime/saboteur_construction_process"
import { ObserveNukeLandingProcess } from "process/onetime/nuke/observe_nuke_landing_process"
import { DisturbCreepSpawnProcess } from "process/onetime/disturb_creep_spawn_process"
import { SellResourcesProcess } from "process/onetime/sell_resources_process"
import { SignRoomsProcess } from "process/onetime/sign_rooms_process"
import { SaboteurHarvestProcess } from "process/onetime/saboteur_harvest_process"
// import {} from "process/non_game/distribution_simulation_process"
import { } from "../../../../submodules/private/attack/quad_v2/quad_maker_process"
import { MaintainLostRoomProcess } from "process/onetime/maintain_lost_room_process"
import { DistributePowerProcess } from "process/process/distribute_power_process"
import { Season5ClaimReactorProcess } from "process/temporary/season5_claim_reactor_process"
import { Season5FillReactorProcess } from "process/temporary/season5_fill_reactor_process"
import { ReportProcess } from "process/process/report/report_process"
import { ReverseReactionProcess } from "process/onetime/reverse_reaction_process"
import { CollectDroppedResourceProcess } from "process/onetime/collect_dropped_resource_process"
import {  } from "process/onetime/collect_dropped_resource_once_process"
import { InterRoomEnergyTransferProcess } from "process/process/inter_room_energy_transfer_process"

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
      case "Season487837AttackInvaderCoreProcess":
        return this.launchSeason487837AttackInvaderCoreProcess()
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
      return `${coloredText("[Launch Failed]", "error")} ${result.reason}`
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

  private launchSeason487837AttackInvaderCoreProcess(): LaunchCommandResult {
    const process = OperatingSystem.os.addProcess(null, processId => {
      return Season487837AttackInvaderCoreProcess.create(processId)
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
    const roomName = roomResource.room.name
    const powerSpawn = roomResource.activeStructures.powerSpawn
    if (powerSpawn == null) {
      throw `no power spawn in ${roomLink(roomResource.room.name)}`
    }

    const processInfo = OperatingSystem.os.listAllProcesses().find(processInfo => {
      if (!(processInfo.process instanceof PowerProcessProcess)) {
        return false
      }
      if (processInfo.process.parentRoomName !== roomName) {
        return false
      }
      return true
    })

    if (processInfo != null) {
      throw `PowerProcessProcess for ${roomLink(roomName)} already exists (${processInfo.processId})`
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
    const roomResource = args.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
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
    if (canSpawnGuardCreep(creepType, roomResource.room.energyCapacityAvailable) !== true) {
      throw `cannot spawn ${creepType} in ${roomLink(roomName)} (capacity: roomResource.room.energyCapacityAvailable)`
    }

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

    const products = args.list("products", "commodity").parseOptional()
    const options = {
      products: products ?? undefined,
    }

    return Result.Succeeded((processId) => ContinuouslyProduceCommodityProcess.create(processId, roomName, factory, options))
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
    getWaypoints(args, roomName, targetRoomName)

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

ProcessLauncher.register("HaulEnergyProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const waypoints = getWaypoints(args, roomName, targetRoomName)
    const finishWorking = args.int("finish_working").parse({ min: 0, max: GameConstants.creep.life.lifeTime })
    const numberOfCreeps = args.int("creep_count").parse({ min: 1 })

    return Result.Succeeded((processId) => HaulEnergyProcess.create(
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

ProcessLauncher.register("DefenseNukeProcess", args => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
    const nukes = roomResource.room.find(FIND_NUKES)
    const excludedStructureIds = (args.list("excluded_structure_ids", "object_id").parseOptional() ?? []) as Id<AnyOwnedStructure>[]

    return Result.Succeeded((processId) => DefenseNukeProcess.create(
      processId,
      roomName,
      nukes,
      excludedStructureIds,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("StealResourceProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})
    const targetRoomName = args.roomName("target_room_name").parseOptional() ?? roomName
    const targetId = args.gameObjectId("target_id").parse()
    const finishWorking = args.int("finish_working").parse({min: 0, max: GameConstants.creep.life.lifeTime})
    const numberOfCreeps = args.int("creeps").parse({min: 1})
    const waypoints = getWaypoints(args, roomName, targetRoomName)
    const options = ((): { storeId?: Id<StructureStorage | StructureTerminal> } => {
      const store = args.visibleGameObject("store_id").parseOptional({ inRoomName: roomName })
      if (store == null) {
        return {}
      }
      if (!(store instanceof StructureStorage) && !(store instanceof StructureTerminal)) {
        throw `store_id is not storage or terminal (${store})`
      }
      return {
        storeId: store.id,
      }
    })()

    return Result.Succeeded((processId) => StealResourceProcess.create(
      processId,
      roomName,
      targetRoomName,
      waypoints,
      targetId as Id<StructureStorage>,
      true,
      numberOfCreeps,
      finishWorking,
      options,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("World42768365ProblemSolverProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse()

    return Result.Succeeded((processId) => World42768365ProblemSolverProcess.create(
      processId,
      roomName,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("World42791528ProblemFinderProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})

    return Result.Succeeded((processId) => World42791528ProblemFinderProcess.create(
      processId,
      roomName,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("ClaimProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const maxClaimSize = args.int("max_claim_size").parseOptional({min: 1})

    return Result.Succeeded((processId) => ClaimProcess.create(
      processId,
      roomName,
      targetRoomName,
      maxClaimSize,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("MapVisualProcess", args => {
  try {
    const duration = args.int("duration").parse({min: 1})

    return Result.Succeeded((processId) => MapVisualProcess.create(
      processId,
      duration,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("SellAllResourcesProcess", () => {
  try {
    if (Environment.world === "persistent world") {
      throw "SellAllResourcesProcess is disabled"
    }

    for (const processInfo of OperatingSystem.os.listAllProcesses()) {
      if (!(processInfo.process instanceof InterRoomResourceManagementProcess)) {
        continue
      }
      if (processInfo.running === true) {
        throw `InterRoomResourceManagementProcess ${processInfo.processId} is still running`
      }
      break
    }

    return Result.Succeeded((processId) => SellAllResourcesProcess.create(
      processId,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("LandOccupationProcess", args => {
  try {
    const room = args.room("room_name").parse()
    const roomName = room.name
    const controller = room.controller
    if (controller == null) {
      // TODO: 自動でObserveするようにする
      throw `No controller in ${roomLink(roomName)}`
    }

    const parentRoomName = args.roomName("parent_room_name").parse({my: true})

    getWaypoints(args, parentRoomName, roomName)  // waypointの確認

    const mainSource = args.visibleGameObject("main_source_id").parse({ inRoomName: roomName })
    const mainCenterPosition = args.localPosition("main_center").parse()
    const controllerCenterPosition = args.localPosition("controller_center").parse()

    if (!(mainSource instanceof Source)) {
      throw `${mainSource} is not a Source`
    }

    const emptyPositionFilteringOptions: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeTerrainWalls: true,
      excludeWalkableStructures: false,
    }

    const mainSourcePlan = ((): ClusterPlan => {
      const plan: { [SerializedPosition: string]: LandOccupationStructureTypes | BuildableWallTypes } = {}
      plan[serializePosition(mainCenterPosition)] = STRUCTURE_CONTAINER

      const requiredStructures = [
        STRUCTURE_SPAWN,
        STRUCTURE_TOWER,
      ]
      const emptyPositions = decodeRoomPosition(mainCenterPosition, roomName).positionsInRange(1, emptyPositionFilteringOptions)

      for (const position of emptyPositions) {
        const structureType = requiredStructures.shift()
        if (structureType == null) {
          break
        }

        plan[serializePosition(position)] = structureType
      }

      if (requiredStructures.length > 0) {
        throw `Lack of empty positions around main source: ${emptyPositions}`
      }

      return {
        center: mainCenterPosition,
        plan,
      }
    })()

    const controllerPlan = ((): ClusterPlan => {
      const plan: { [SerializedPosition: string]: LandOccupationStructureTypes | BuildableWallTypes } = {}
      plan[serializePosition(controllerCenterPosition)] = STRUCTURE_CONTAINER

      const emptyPositions = decodeRoomPosition(controller.pos, roomName).positionsInRange(1, emptyPositionFilteringOptions)

      for (const position of emptyPositions) {
        if (position.isEqualTo(controllerCenterPosition.x, controllerCenterPosition.y) === true) {
          continue
        }

        plan[serializePosition(position)] = STRUCTURE_WALL
      }

      return {
        center: mainCenterPosition,
        plan,
      }
    })()

    return Result.Succeeded((processId) => LandOccupationProcess.create(
      processId,
      roomName,
      parentRoomName,
      mainSourcePlan,
      controllerPlan,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("NukerManagementProcess", () => {
  try {
    return Result.Succeeded((processId) => NukerManagementProcess.create(
      processId,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("LaunchNukeProcess", args => {
  try {
    const rooms = args.list("room_names", "room").parse({ my: true })
    const forced = args.boolean("forced").parseOptional() ?? false
    const targetRoomName = args.roomName("target_room_name").parse()
    const delay = args.int("delay").parse({ min: 0 })

    const nukers = rooms.map(room => {
      const nuker = (room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]) as StructureNuker | undefined
      if (nuker == null) {
        throw `${roomLink(room.name)} has no nuker`
      }

      if (forced !== true) {
        const result = isNukerReady(nuker, delay)
        if (result !== true) {
          throw `nuker in ${roomLink(nuker.room.name)} is not ready (${result}) (set "forced=1" to force launch)`
        }
      }

      return nuker
    })

    const targetIds = args.list("target_ids", "object_id").parseOptional() ?? []
    const targetStructureTypes = args.list("target_structure_types", "string").parseOptional() ?? []
    const targetPositions = args.list("target_positions", "local_position").parseOptional() ?? []

    if (targetIds.length <= 0 && targetStructureTypes.length <= 0 && targetPositions.length <= 0) {
      throw "no target: specify targets by \"target_ids\", \"target_structure_types\" and/or \"target_positions\""
    }

    rooms.forEach(room => {
      const distance = Game.map.getRoomLinearDistance(room.name, targetRoomName)
      if (distance > NUKE_RANGE) {
        throw `${roomLink(room.name)} is out of range (${distance})`
      }
    })

    /** @throws */
    const launchProcess = (processId: ProcessId, targetRoom: Room): LaunchNukeProcess => {
      const targetObjects = targetIds.map(targetId => {
        const targetObject = Game.getObjectById(targetId)
        if (targetObject == null) {
          throw `no object with ID ${targetId}`
        }
        if (!(targetObject instanceof RoomObject)) {
          throw `${targetObject} is not RoomObject`
        }
        if (targetObject.room == null || targetObject.room.name !== targetRoomName) {
          throw `${targetObject} is not in the target room ${roomLink(targetRoomName)}`
        }
        return targetObject
      })

      const targetStructures = targetRoom.find(FIND_STRUCTURES).filter(structure => {
        if (targetStructureTypes.includes(structure.structureType) !== true) {
          return false
        }
        return true
      })

      const allTargetPositions: Position[] = [
        ...targetObjects.map(targetObject => targetObject.pos),
        ...targetStructures.map(structure => structure.pos),
        ...targetPositions,
      ].map(position => ({x: position.x, y: position.y})) // 最終的にMemoryへ保存するため、encodableなオブジェクトに強制する

      if (nukers.length !== allTargetPositions.length) {
        throw `number of nukers (${nukers.length}) shoud be same as number of targets (${allTargetPositions.length})`
      }

      const targetInfo: NukeTargetInfo[] = nukers.map((nuker, index) => {
        const targetPosition = allTargetPositions[index]
        if (targetPosition == null) {
          throw `target position is null (${index})`
        }
        return {
          nukerId: nuker.id,
          position: targetPosition,
        }
      })

      return LaunchNukeProcess.create(
        processId,
        targetRoomName,
        targetInfo,
        delay,
      )
    }

    const checkedTargetRoom = Game.rooms[targetRoomName]
    if (checkedTargetRoom == null) {
      const observerRoomResource = args.ownedRoomResource("observer_room_name", { missingArgumentErrorMessage: `observer_room_name is required since the target room ${roomLink(targetRoomName)} is invisible` }).parse()
      if (observerRoomResource.activeStructures.observer == null) {
        throw `no observer in ${roomLink(observerRoomResource.room.name)}`
      }

      const observeResult = observerRoomResource.activeStructures.observer.observeRoom(targetRoomName)
      switch (observeResult) {
      case OK:
        PrimitiveLogger.log(`reserve observation ${roomLink(targetRoomName)} at ${Game.time}`)
        break
      default:
        throw `observe room ${roomLink(targetRoomName)} failed with ${observeResult}`
      }

      return Result.Succeeded((processId) => OnHeapDelayProcess.create(
        processId,
        `observe ${roomLink(targetRoomName)} to plan nuker attack`,
        1,
        (): string => {
          const observedRoom = Game.rooms[targetRoomName]
          if (observedRoom == null) {
            throw `${roomLink(targetRoomName)} observation failed at ${Game.time}`
          }

          const process = OperatingSystem.os.addProcess(null, processId => launchProcess(processId, observedRoom))

          Memory.os.logger.filteringProcessIds.push(process.processId)  // 引数を持ち越せないため手動で

          return `process launched ${process.taskIdentifier}, ${process.processId}`
        },
      ))
    }

    return Result.Succeeded(processId => launchProcess(processId, checkedTargetRoom))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("ConsecutiveNukeProcess", args => {
  try {
    const rooms = args.list("room_names", "room").parse({ my: true })
    const forced = args.boolean("forced").parseOptional() ?? false
    const targetRoomName = args.roomName("target_room_name").parse()
    const delay = args.int("delay").parse({ min: 0 })
    const interval = args.int("interval").parse({ min: 0 })

    const nukers = rooms.map(room => {
      const nuker = (room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_NUKER } })[0]) as StructureNuker | undefined
      if (nuker == null) {
        throw `${roomLink(room.name)} has no nuker`
      }

      if (forced !== true) {
        const result = isConsecutiveNukerReady(nuker, delay)
        if (result !== true) {
          throw `nuker in ${roomLink(nuker.room.name)} is not ready (${result}) (set "forced=1" to force launch)`
        }
      }

      return nuker
    })

    const targetIds = args.list("target_ids", "object_id").parseOptional() ?? []
    const targetStructureTypes = args.list("target_structure_types", "string").parseOptional() ?? []
    const targetPositions = args.list("target_positions", "local_position").parseOptional() ?? []

    if (targetIds.length <= 0 && targetStructureTypes.length <= 0 && targetPositions.length <= 0) {
      throw "no target: specify targets by \"target_ids\", \"target_structure_types\" and/or \"target_positions\""
    }

    rooms.forEach(room => {
      const distance = Game.map.getRoomLinearDistance(room.name, targetRoomName)
      if (distance > NUKE_RANGE) {
        throw `${roomLink(room.name)} is out of range (${distance})`
      }
    })

    /** @throws */
    const launchProcess = (processId: ProcessId, targetRoom: Room): ConsecutiveNukeProcess => {
      const targetObjects = targetIds.map(targetId => {
        const targetObject = Game.getObjectById(targetId)
        if (targetObject == null) {
          throw `no object with ID ${targetId}`
        }
        if (!(targetObject instanceof RoomObject)) {
          throw `${targetObject} is not RoomObject`
        }
        if (targetObject.room == null || targetObject.room.name !== targetRoomName) {
          throw `${targetObject} is not in the target room ${roomLink(targetRoomName)}`
        }
        return targetObject
      })

      const targetStructures = targetRoom.find(FIND_STRUCTURES).filter(structure => {
        if (targetStructureTypes.includes(structure.structureType) !== true) {
          return false
        }
        return true
      })

      const allTargetPositions: Position[] = [
        ...targetObjects.map(targetObject => targetObject.pos),
        ...targetStructures.map(structure => structure.pos),
        ...targetPositions,
      ].map(position => ({ x: position.x, y: position.y })) // 最終的にMemoryへ保存するため、encodableなオブジェクトに強制する

      if (nukers.length !== allTargetPositions.length) {
        throw `number of nukers (${nukers.length}) shoud be same as number of targets (${allTargetPositions.length})`
      }

      const targetInfo: ConsecutiveNukeTargetInfo[] = nukers.map((nuker, index) => {
        const targetPosition = allTargetPositions[index]
        if (targetPosition == null) {
          throw `target position is null (${index})`
        }
        return {
          nukerId: nuker.id,
          position: targetPosition,
        }
      })

      return ConsecutiveNukeProcess.create(
        processId,
        targetRoomName,
        targetInfo,
        delay,
        interval,
      )
    }

    const checkedTargetRoom = Game.rooms[targetRoomName]
    if (checkedTargetRoom == null) {
      const observerRoomResource = args.ownedRoomResource("observer_room_name", { missingArgumentErrorMessage: `observer_room_name is required since the target room ${roomLink(targetRoomName)} is invisible` }).parse()
      if (observerRoomResource.activeStructures.observer == null) {
        throw `no observer in ${roomLink(observerRoomResource.room.name)}`
      }

      const observeResult = observerRoomResource.activeStructures.observer.observeRoom(targetRoomName)
      switch (observeResult) {
      case OK:
        PrimitiveLogger.log(`reserve observation ${roomLink(targetRoomName)} at ${Game.time}`)
        break
      default:
        throw `observe room ${roomLink(targetRoomName)} failed with ${observeResult}`
      }

      return Result.Succeeded((processId) => OnHeapDelayProcess.create(
        processId,
        `observe ${roomLink(targetRoomName)} to plan nuker attack`,
        1,
        (): string => {
          const observedRoom = Game.rooms[targetRoomName]
          if (observedRoom == null) {
            throw `${roomLink(targetRoomName)} observation failed at ${Game.time}`
          }

          const process = OperatingSystem.os.addProcess(null, processId => launchProcess(processId, observedRoom))

          Memory.os.logger.filteringProcessIds.push(process.processId)  // 引数を持ち越せないため手動で

          return `process launched ${process.taskIdentifier}, ${process.processId}`
        },
      ))
    }

    return Result.Succeeded(processId => launchProcess(processId, checkedTargetRoom))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("SaboteurConstructionProcess", args => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
    const targetRoomName = args.roomName("target_room_name").parse()
    const numberOfCreeps = args.int("creep_count").parse({min: 1})
    getWaypoints(args, roomName, targetRoomName)

    return Result.Succeeded((processId) => SaboteurConstructionProcess.create(
      processId,
      roomName,
      targetRoomName,
      numberOfCreeps,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("ObserveNukeLandingProcess", args => {
  try {
    const targetRoomName = args.roomName("target_room_name").parse()
    const observerRoomResource = args.ownedRoomResource("observer_room_name").parse()
    const observer = observerRoomResource.activeStructures.observer
    if (observer == null) {
      throw `no observer in ${roomLink(observerRoomResource.room.name)}`
    }
    const nukeLandingUntil = args.int("nuke_landing_until").parse()

    return Result.Succeeded((processId) => ObserveNukeLandingProcess.create(
      processId,
      targetRoomName,
      observer.id,
      nukeLandingUntil + Game.time,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("DisturbCreepSpawnProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})
    const targetRoomName = args.roomName("target_room_name").parse()
    const travelDistance = args.int("travel_distance").parse({ min: 50, max: 1400 })
    const codename = args.string("codename").parseOptional() ?? null
    getWaypoints(args, roomName, targetRoomName)

    return Result.Succeeded((processId) => DisturbCreepSpawnProcess.create(
      processId,
      roomName,
      targetRoomName,
      travelDistance,
      codename,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("SellResourcesProcess", args => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
    if (roomResource.activeStructures.terminal == null) {
      throw `${roomLink(roomName)} has no terminal`
    }
    const resourceTypes = args.list("resource_types", "resource").parse()

    const keepRunning = args.boolean("keep_running").parse()

    return Result.Succeeded((processId) => SellResourcesProcess.create(
      processId,
      roomName,
      resourceTypes,
      keepRunning,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("SignRoomsProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})
    const targetRoomNames = args.list("target_room_names", "room_name").parse()
    const signs = args.list("signs", "string").parseOptional({allowSpacing: true})

    return Result.Succeeded((processId) => SignRoomsProcess.create(
      processId,
      roomName,
      targetRoomNames,
      signs,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("SaboteurHarvestProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const travelDistance = args.int("travel_distance").parse({ min: 50 })
    const reservedPosition = args.localPosition("reserved_position").parse()
    getWaypoints(args, roomName, targetRoomName)

    return Result.Succeeded((processId) => SaboteurHarvestProcess.create(
      processId,
      roomName,
      targetRoomName,
      travelDistance,
      reservedPosition,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("MaintainLostRoomProcess", args => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()
    const roomName = roomResource.room.name
    const targetRoomResource = args.ownedRoomResource("target_room_name").parse()
    const targetRoomName = targetRoomResource.room.name
    if (targetRoomResource.activeStructures.spawns.length > 0) {
      throw `${roomLink(targetRoomName)} has spawns`
    }

    getWaypoints(args, roomName, targetRoomName)

    return Result.Succeeded((processId) => MaintainLostRoomProcess.create(
      processId,
      roomName,
      targetRoomName,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("DistributePowerProcess", args => {
  try {
    const interval = args.int("interval").parse({ min: 1 })

    return Result.Succeeded((processId) => DistributePowerProcess.create(
      processId,
      interval,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season5ClaimReactorProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({my: true})
    const targetRoomName = args.roomName("target_room_name").parse()

    getWaypoints(args, roomName, targetRoomName)

    return Result.Succeeded((processId) => Season5ClaimReactorProcess.create(
      processId,
      roomName,
      targetRoomName,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("Season5FillReactorProcess", args => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    const bodyUnitSize = args.int("body_unit_size").parse({ min: 1, max: 25 })
    const delay = args.int("delay").parse({ min: 0 })
    const startsAt = Game.time + delay

    getWaypoints(args, roomName, targetRoomName)

    return Result.Succeeded((processId) => Season5FillReactorProcess.create(
      processId,
      roomName,
      targetRoomName,
      bodyUnitSize,
      startsAt,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})


ProcessLauncher.register("ReportProcess", () => {
  try {
    return Result.Succeeded((processId) => ReportProcess.create(
      processId,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("ReverseReactionProcess", (args) => {
  try {
    const roomResource = args.ownedRoomResource("room_name").parse()

    if (roomResource.roomInfo.researchLab == null) {
      throw `No research labs in ${roomLink(roomResource.room.name)}`
    }

    if (roomResource.roomInfo.config != null && roomResource.roomInfo.config.researchCompounds != null) {
      if (Array.from(Object.keys(roomResource.roomInfo.config.researchCompounds)).length > 0) {
        roomResource.roomInfo.config.researchCompounds = {}
      }
    }
    roomResource.roomInfoAccessor.removeAllBoosts()

    const compoundType = args.typedString("compound", "MineralCompoundConstant", isMineralCompoundConstant).parse()

    return Result.Succeeded((processId) => ReverseReactionProcess.create(
      processId,
      roomResource.room.name,
      compoundType,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("PowerCreepStealProcess", (args) => {
  try {
    const roomName = args.roomName("room_name").parse({ my: true })
    const targetRoomName = args.roomName("target_room_name").parse()
    getWaypoints(args, roomName, targetRoomName)

    const process = OperatingSystem.os.listAllProcesses().find(processInfo => {
      if (processInfo.process instanceof PowerCreepProcess) {
        if (processInfo.process.ownedRoomName === roomName) {
          return true
        }
      }
      return false
    })

    if (process == null) {
      throw `No running PowerCreepProcess in ${roomLink(roomName)}`
    }
    OperatingSystem.os.suspendProcess(process.processId)
    const powerCreepProcess = process.process as PowerCreepProcess

    const targetIds = args.list("target_ids", "object_id").parse() as Id<StructureStorage | StructureTerminal>[]

    return Result.Succeeded((processId) => PowerCreepStealProcess.create(
      processId,
      roomName,
      targetRoomName,
      powerCreepProcess.powerCreepName,
      powerCreepProcess.processId,
      targetIds,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("CollectDroppedResourceProcess", args => {
  const roomName = args.roomName("room_name").parse({ my: true })

  try {
    return Result.Succeeded((processId) => CollectDroppedResourceProcess.create(
      processId,
      roomName,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})

ProcessLauncher.register("InterRoomEnergyTransferProcess", () => {
  try {
    return Result.Succeeded((processId) => InterRoomEnergyTransferProcess.create(
      processId,
    ))
  } catch (error) {
    return Result.Failed(`${error}`)
  }
})


// ProcessLauncher.register("IntrashardResourceWatchdogProcess", () => {
//   try {
//     return Result.Succeeded((processId) => IntrashardResourceWatchdogProcess.create(
//       processId,
//     ))
//   } catch (error) {
//     return Result.Failed(`${error}`)
//   }
// })

// ProcessLauncher.register("IntershardResourceTransferProcess", args => {
//   try {
//     if (Environment.hasMultipleShards !== true) {
//       throw `${Environment.world} doesn't have multiple shards`
//     }
//     // if (InterShardMemoryWatcher == null) {
//       throw "missing InterShardMemoryWatcher"
//     // }

//     const roomName = args.roomName("room_name").parse({my: true})
//     const portalRoomName = args.roomName("portal_room_name").parse()
//     const targetShardName = args.string("target_shard_name").parse()
//     const finishWorking = args.int("finish_working").parse({min: 0, max: GameConstants.creep.life.lifeTime})
//     const creepCount = args.int("creep_count").parse({ min: 1 })

//     return Result.Succeeded((processId) => IntershardResourceTransferProcess.create(
//       processId,
//       roomName,
//       portalRoomName,
//       targetShardName,
//       finishWorking,
//       creepCount,
//     ))
//   } catch (error) {
//     return Result.Failed(`${error}`)
//   }
// })

// ProcessLauncher.register("IntershardResourceReceiverProcess", args => {
//   try {
//     if (Environment.hasMultipleShards !== true) {
//       throw `${Environment.world} doesn't have multiple shards`
//     }
//     if (InterShardMemoryWatcher == null) {
//       throw "missing InterShardMemoryWatcher"
//     }

//     const transferProcessIdentifier = args.string("transfer_process_identifier").parse()
//     const roomName = args.roomName("room_name").parse({ my: true })
//     const portalRoomName = args.roomName("portal_room_name").parse()
//     const targetShardName = args.string("target_shard_name").parse()

//     return Result.Succeeded((processId) => IntershardResourceReceiverProcess.create(
//       processId,
//       transferProcessIdentifier,
//       roomName,
//       portalRoomName,
//       targetShardName,
//     ))
//   } catch (error) {
//     return Result.Failed(`${error}`)
//   }
// })

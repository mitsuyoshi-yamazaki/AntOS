import { ErrorMapper } from "error_mapper/ErrorMapper"
import { TestChildProcess, TestChildProcessState, TestProcess, TestProcessState } from "process/test/test_process"
import { BootstrapRoomManagerProcess, BootstrapRoomManagerProcessState } from "./bootstrap_room_manager_process"
import { Season1143119BoostedAttackProcess, Season1143119BoostedAttackProcessState } from "./onetime/season_1143119_boosted_attack_process"
import { Season1143119LabChargerProcess, Season1143119LabChargerProcessState } from "./onetime/season_1143119_lab_charger_process"
import { Season1200082SendMineralProcess, Season1200082SendMineralProcessState } from "./onetime/season_1200082_send_mineral_process"
import { Season1244215GenericDismantleProcess, Season1244215GenericDismantleProcessState } from "./onetime/season_1244215_generic_dismantle_process"
import { Season1262745GuardRemoteRoomProcess, Season1262745GuardRemoteRoomProcessState } from "./onetime/season_1262745_guard_remote_room_process"
import { Season1349943DisturbPowerHarvestingProcess, Season1349943DisturbPowerHarvestingProcessState } from "./onetime/season_1349943_disturb_power_harvesting_process"
import { Season487837AttackInvaderCoreProcess, Season487837AttackInvaderCoreProcessState } from "./onetime/season_487837_attack_invader_core_process"
import { Season570208DismantleRcl2RoomProcess, Season570208DismantleRcl2RoomProcessState } from "./onetime/season_570208_dismantle_rcl2_room_process"
import { Season631744PowerProcessProcess, Season631744PowerProcessProcessState } from "./onetime/season_631744_power_process_process"
import { Season634603PowerCreepProcess, Season634603PowerCreepProcessState } from "./onetime/season_634603_power_creep_process"
import { Season701205PowerHarvesterSwampRunnerProcess, Season701205PowerHarvesterSwampRunnerProcessState } from "./onetime/season_701205_power_harvester_swamp_runner_process"
import { Season845677Attack1TowerProcess, Season845677Attack1TowerProcessState } from "./onetime/season_845677_attack_1tower_process"
import { Season989041MovePowerCreepProcess, Season989041MovePowerCreepProcessState } from "./onetime/season_989041_move_power_creep_process"
import { Season1521073SendResourceProcess, Season1521073SendResourceProcessState } from "./onetime/season_1521073_send_resource_process"
import { Season1606052SKHarvesterProcess, Season1606052SKHarvesterProcessState } from "./onetime/season_1606052_sk_harvester_process"
import { Season1655635SKMineralHarvestProcess, Season1655635SKMineralHarvestProcessState } from "./onetime/season_1655635_sk_mineral_harvest_process"
import { Season1673282SpecializedQuadProcess, Season1673282SpecializedQuadProcessState } from "./onetime/season_1673282_specialized_quad_process"
import { Season1838855DistributorProcess, Season1838855DistributorProcessState } from "./onetime/season_1838855_distributor_process"
import { Season2006098StealResourceProcess, Season2006098StealResourceProcessState } from "./onetime/season_2006098_steal_resource_process"
import { Season2055924SendResourcesProcess, Season2055924SendResourcesProcessState } from "./onetime/season_2055924_send_resources_process"
import { World35440623DowngradeControllerProcess, World35440623DowngradeControllerProcessState } from "./onetime/world_35440623_downgrade_controller_process"
import { World35587255ScoutRoomProcess, World35587255ScoutRoomProcessState } from "./onetime/world_35587255_scout_room_process"
import { World35588848GclManagerProcess, World35588848GclManagerProcessState } from "./onetime/world_35588848_gcl_manager_process"
// import { World35591718AllianceRequestProcess, World35591718AllianceRequestProcessState } from "./onetime/world_35591718_alliance_request_process"
import { BuyPixelProcess, BuyPixelProcessState } from "./process/buy_pixel_process"
import { UpgradePowerCreepProcess, UpgradePowerCreepProcessState } from "./process/upgrade_power_creep_process"
import { InterRoomResourceManagementProcess, InterRoomResourceManagementProcessState } from "./process/inter_room_resource_management_process"
import { ObserveRoomProcess, ObserveRoomProcessState } from "./process/observe_room_process"
import type { Process } from "./process"
import type { ProcessState } from "./process_state"
import { RoomKeeperProcess, RoomKeeperProcessState } from "./room_keeper_process"
import { TaskProcess, TaskProcessState } from "./task_process"
import { V6RoomKeeperProcess, V6RoomKeeperProcessState } from "./v6_room_keeper_process"
import { PrioritizerProcess, PrioritizerProcessState } from "./application/prioritizer_process"

export type ProcessTypeIdentifier = keyof ProcessTypes
class ProcessTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "TestProcess" = (state: ProcessState) => TestProcess.decode(state as unknown as TestProcessState)
  "TestChildProcess" = (state: ProcessState) => TestChildProcess.decode(state as unknown as TestChildProcessState)
  "BuyPixelProcess" = (state: ProcessState) => BuyPixelProcess.decode(state as unknown as BuyPixelProcessState)
  "UpgradePowerCreepProcess" = (state: ProcessState) => UpgradePowerCreepProcess.decode(state as unknown as UpgradePowerCreepProcessState)

  // ---- v5 Process ---- //
  "RoomKeeperProcess" = (state: ProcessState) => RoomKeeperProcess.decode(state as unknown as RoomKeeperProcessState)
  "BootstrapRoomManagerProcess" = (state: ProcessState) => BootstrapRoomManagerProcess.decode(state as unknown as BootstrapRoomManagerProcessState)
  "TaskProcess" = (state: ProcessState) => TaskProcess.decode(state as unknown as TaskProcessState)
  "InterRoomResourceManagementProcess" = (state: ProcessState) => InterRoomResourceManagementProcess.decode(state as unknown as InterRoomResourceManagementProcessState)
  "ObserveRoomProcess" = (state: ProcessState) => ObserveRoomProcess.decode(state as unknown as ObserveRoomProcessState)

  // ---- v6 Process ---- //
  "V6RoomKeeperProcess" = (state: ProcessState) => V6RoomKeeperProcess.decode(state as unknown as V6RoomKeeperProcessState)

  // ---- Application ---- //
  "PrioritizerProcess" = (state: ProcessState) => PrioritizerProcess.decode(state as unknown as PrioritizerProcessState)

  // ---- Onetime processes ---- //
  "Season487837AttackInvaderCoreProcess" = (state: ProcessState) => Season487837AttackInvaderCoreProcess.decode(state as unknown as Season487837AttackInvaderCoreProcessState)
  "Season570208DismantleRcl2RoomProcess" = (state: ProcessState) => Season570208DismantleRcl2RoomProcess.decode(state as unknown as Season570208DismantleRcl2RoomProcessState)
  "Season631744PowerProcessProcess" = (state: ProcessState) => Season631744PowerProcessProcess.decode(state as unknown as Season631744PowerProcessProcessState)
  "Season634603PowerCreepProcess" = (state: ProcessState) => Season634603PowerCreepProcess.decode(state as unknown as Season634603PowerCreepProcessState)
  "Season701205PowerHarvesterSwampRunnerProcess" = (state: ProcessState) => Season701205PowerHarvesterSwampRunnerProcess.decode(state as unknown as Season701205PowerHarvesterSwampRunnerProcessState)
  "Season845677Attack1TowerProcess" = (state: ProcessState) => Season845677Attack1TowerProcess.decode(state as unknown as Season845677Attack1TowerProcessState)
  "Season989041MovePowerCreepProcess" = (state: ProcessState) => Season989041MovePowerCreepProcess.decode(state as unknown as Season989041MovePowerCreepProcessState)
  "Season1143119LabChargerProcess" = (state: ProcessState) => Season1143119LabChargerProcess.decode(state as unknown as Season1143119LabChargerProcessState)
  "Season1143119BoostedAttackProcess" = (state: ProcessState) => Season1143119BoostedAttackProcess.decode(state as unknown as Season1143119BoostedAttackProcessState)
  "Season1200082SendMineralProcess" = (state: ProcessState) => Season1200082SendMineralProcess.decode(state as unknown as Season1200082SendMineralProcessState)
  "Season1244215GenericDismantleProcess" = (state: ProcessState) => Season1244215GenericDismantleProcess.decode(state as unknown as Season1244215GenericDismantleProcessState)
  "Season1262745GuardRemoteRoomProcess" = (state: ProcessState) => Season1262745GuardRemoteRoomProcess.decode(state as unknown as Season1262745GuardRemoteRoomProcessState)
  "Season1349943DisturbPowerHarvestingProcess" = (state: ProcessState) => Season1349943DisturbPowerHarvestingProcess.decode(state as unknown as Season1349943DisturbPowerHarvestingProcessState)
  "Season1521073SendResourceProcess" = (state: ProcessState) => Season1521073SendResourceProcess.decode(state as unknown as Season1521073SendResourceProcessState)
  "Season1606052SKHarvesterProcess" = (state: ProcessState) => Season1606052SKHarvesterProcess.decode(state as unknown as Season1606052SKHarvesterProcessState)
  "Season1655635SKMineralHarvestProcess" = (state: ProcessState) => Season1655635SKMineralHarvestProcess.decode(state as unknown as Season1655635SKMineralHarvestProcessState)
  "Season1673282SpecializedQuadProcess" = (state: ProcessState) => Season1673282SpecializedQuadProcess.decode(state as unknown as Season1673282SpecializedQuadProcessState)
  "Season1838855DistributorProcess" = (state: ProcessState) => Season1838855DistributorProcess.decode(state as unknown as Season1838855DistributorProcessState)
  "Season2006098StealResourceProcess" = (state: ProcessState) => Season2006098StealResourceProcess.decode(state as unknown as Season2006098StealResourceProcessState)
  "Season2055924SendResourcesProcess" = (state: ProcessState) => Season2055924SendResourcesProcess.decode(state as unknown as Season2055924SendResourcesProcessState)
  "World35440623DowngradeControllerProcess" = (state: ProcessState) => World35440623DowngradeControllerProcess.decode(state as unknown as World35440623DowngradeControllerProcessState)
  "World35587255ScoutRoomProcess" = (state: ProcessState) => World35587255ScoutRoomProcess.decode(state as unknown as World35587255ScoutRoomProcessState)
  "World35588848GclManagerProcess" = (state: ProcessState) => World35588848GclManagerProcess.decode(state as unknown as World35588848GclManagerProcessState)
  // "World35591718AllianceRequestProcess" = (state: ProcessState) => World35591718AllianceRequestProcess.decode(state as unknown as World35591718AllianceRequestProcessState)
}

export function decodeProcessFrom(state: ProcessState): Process | null {
  let decoded: Process | null = null
  ErrorMapper.wrapLoop(() => {
    const maker = (new ProcessTypes())[state.t]
    if (maker == null) {
      decoded = null
      return
    }
    decoded = maker(state)
  }, `decodeProcessFrom(), process type: ${state.t}`)()
  return decoded
}

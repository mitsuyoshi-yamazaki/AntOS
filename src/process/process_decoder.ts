import { ErrorMapper } from "error_mapper/ErrorMapper"
import { LoggerProcess, LoggerProcessState } from "os/process/logger"
import { TestProcess, TestProcessState } from "process/test/test_process"
import { BootstrapRoomManagerProcess, BootstrapRoomManagerProcessState } from "./bootstrap_room_manager_process"
import { Season1022818Attack2TowerRoomProcess, Season1022818Attack2TowerRoomProcessState } from "./onetime/season_1022818_attack_2tower_room_process"
import { Season1105755HarvestMineralProcess, Season1105755HarvestMineralProcessState } from "./onetime/season_1105755_harvest_mineral_process"
import { Season1143119BoostedAttackProcess, Season1143119BoostedAttackProcessState } from "./onetime/season_1143119_boosted_attack_process"
import { Season1143119LabChargerProcess, Season1143119LabChargerProcessState } from "./onetime/season_1143119_lab_charger_process"
import { Season1200082SendMineralProcess, Season1200082SendMineralProcessState } from "./onetime/season_1200082_send_mineral_process"
import { Season1244215GenericDismantleProcess, Season1244215GenericDismantleProcessState } from "./onetime/season_1244215_generic_dismantle_process"
import { Season1249418SendHugeCreepProcess, Season1249418SendHugeCreepProcessState } from "./onetime/season_1249418_send_huge_creep_process"
import { Season1262745GuardRemoteRoomProcess, Season1262745GuardRemoteRoomProcessState } from "./onetime/season_1262745_guard_remote_room_process"
import { Season1349943DisturbPowerHarvestingProcess, Season1349943DisturbPowerHarvestingProcessState } from "./onetime/season_1349943_disturb_power_harvesting_process"
import { Season487837AttackInvaderCoreProcess, Season487837AttackInvaderCoreProcessState } from "./onetime/season_487837_attack_invader_core_process"
import { Season553093AttackRcl3RoomProcess, Season553093AttackRcl3RoomProcessState } from "./onetime/season_553093_attack_rcl3_room_process"
import { Season570208DismantleRcl2RoomProcess, Season570208DismantleRcl2RoomProcessState } from "./onetime/season_570208_dismantle_rcl2_room_process"
import { Season617434PowerHarvestProcess, Season617434PowerHarvestProcessState } from "./onetime/season_617434_power_harvest_process"
import { Season631744PowerProcessProcess, Season631744PowerProcessProcessState } from "./onetime/season_631744_power_process_process"
import { Season634603PowerCreepProcess, Season634603PowerCreepProcessState } from "./onetime/season_634603_power_creep_process"
import { Season701205PowerHarvesterSwampRunnerProcess, Season701205PowerHarvesterSwampRunnerProcessState } from "./onetime/season_701205_power_harvester_swamp_runner_process"
import { Season812484StealPowerProcess, Season812484StealPowerProcessState } from "./onetime/season_812484_steal_power_process"
import { Season831595DismantleRcl2RoomProcess, Season831595DismantleRcl2RoomProcessState } from "./onetime/season_831595_dismantle_rcl2_room_process"
import { Season845677Attack1TowerProcess, Season845677Attack1TowerProcessState } from "./onetime/season_845677_attack_1tower_process"
import { Season989041MovePowerCreepProcess, Season989041MovePowerCreepProcessState } from "./onetime/season_989041_move_power_creep_process"
import type { Process } from "./process"
import { BuyPixelProcess, BuyPixelProcessState } from "./process/buy_pixel_process"
import type { ProcessState } from "./process_state"
import { RoomKeeperProcess, RoomKeeperProcessState } from "./room_keeper_process"
import { TaskProcess, TaskProcessState } from "./task_process"
import { V6RoomKeeperProcess, V6RoomKeeperProcessState } from "./v6_room_keeper_process"
// import { V6RoomKeeperProcess, V6RoomKeeperProcessState } from "./v6_room_keeper_process"

export type ProcessTypeIdentifier = keyof ProcessTypes
class ProcessTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "TestProcess" = (state: ProcessState) => TestProcess.decode(state as unknown as TestProcessState)
  "LoggerProcess" = (state: ProcessState) => LoggerProcess.decode(state as unknown as LoggerProcessState)
  "BuyPixelProcess" = (state: ProcessState) => BuyPixelProcess.decode(state as unknown as BuyPixelProcessState)

  // ---- v5 Process ---- //
  "RoomKeeperProcess" = (state: ProcessState) => RoomKeeperProcess.decode(state as unknown as RoomKeeperProcessState)
  "BootstrapRoomManagerProcess" = (state: ProcessState) => BootstrapRoomManagerProcess.decode(state as unknown as BootstrapRoomManagerProcessState)
  "TaskProcess" = (state: ProcessState) => TaskProcess.decode(state as unknown as TaskProcessState)

  // ---- v6 Process ---- //
  "V6RoomKeeperProcess" = (state: ProcessState) => V6RoomKeeperProcess.decode(state as unknown as V6RoomKeeperProcessState)

  // ---- Onetime processes ---- //
  "Season487837AttackInvaderCoreProcess" = (state: ProcessState) => Season487837AttackInvaderCoreProcess.decode(state as unknown as Season487837AttackInvaderCoreProcessState)
  "Season553093AttackRcl3RoomProcess" = (state: ProcessState) => Season553093AttackRcl3RoomProcess.decode(state as unknown as Season553093AttackRcl3RoomProcessState)
  "Season570208DismantleRcl2RoomProcess" = (state: ProcessState) => Season570208DismantleRcl2RoomProcess.decode(state as unknown as Season570208DismantleRcl2RoomProcessState)
  "Season617434PowerHarvestProcess" = (state: ProcessState) => Season617434PowerHarvestProcess.decode(state as unknown as Season617434PowerHarvestProcessState)
  "Season631744PowerProcessProcess" = (state: ProcessState) => Season631744PowerProcessProcess.decode(state as unknown as Season631744PowerProcessProcessState)
  "Season634603PowerCreepProcess" = (state: ProcessState) => Season634603PowerCreepProcess.decode(state as unknown as Season634603PowerCreepProcessState)
  "Season701205PowerHarvesterSwampRunnerProcess" = (state: ProcessState) => Season701205PowerHarvesterSwampRunnerProcess.decode(state as unknown as Season701205PowerHarvesterSwampRunnerProcessState)
  "Season812484StealPowerProcess" = (state: ProcessState) => Season812484StealPowerProcess.decode(state as unknown as Season812484StealPowerProcessState)
  "Season845677Attack1TowerProcess" = (state: ProcessState) => Season845677Attack1TowerProcess.decode(state as unknown as Season845677Attack1TowerProcessState)
  "Season989041MovePowerCreepProcess" = (state: ProcessState) => Season989041MovePowerCreepProcess.decode(state as unknown as Season989041MovePowerCreepProcessState)
  "Season1022818Attack2TowerRoomProcess" = (state: ProcessState) => Season1022818Attack2TowerRoomProcess.decode(state as unknown as Season1022818Attack2TowerRoomProcessState)
  "Season1105755HarvestMineralProcess" = (state: ProcessState) => Season1105755HarvestMineralProcess.decode(state as unknown as Season1105755HarvestMineralProcessState)
  "Season1143119LabChargerProcess" = (state: ProcessState) => Season1143119LabChargerProcess.decode(state as unknown as Season1143119LabChargerProcessState)
  "Season1143119BoostedAttackProcess" = (state: ProcessState) => Season1143119BoostedAttackProcess.decode(state as unknown as Season1143119BoostedAttackProcessState)
  "Season1200082SendMineralProcess" = (state: ProcessState) => Season1200082SendMineralProcess.decode(state as unknown as Season1200082SendMineralProcessState)
  "Season1244215GenericDismantleProcess" = (state: ProcessState) => Season1244215GenericDismantleProcess.decode(state as unknown as Season1244215GenericDismantleProcessState)
  "Season1249418SendHugeCreepProcess" = (state: ProcessState) => Season1249418SendHugeCreepProcess.decode(state as unknown as Season1249418SendHugeCreepProcessState)
  "Season1262745GuardRemoteRoomProcess" = (state: ProcessState) => Season1262745GuardRemoteRoomProcess.decode(state as unknown as Season1262745GuardRemoteRoomProcessState)
  "Season1349943DisturbPowerHarvestingProcess" = (state: ProcessState) => Season1349943DisturbPowerHarvestingProcess.decode(state as unknown as Season1349943DisturbPowerHarvestingProcessState)
  "Season831595DismantleRcl2RoomProcess" = (state: ProcessState) => Season831595DismantleRcl2RoomProcess.decode(state as unknown as Season831595DismantleRcl2RoomProcessState)
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

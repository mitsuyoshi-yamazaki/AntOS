import type { BotApi } from "os_v5/processes/bot/types"
import type { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import type { CreepTaskStateManagementProcessApi, TaskDrivenCreep, TaskDrivenCreepMemory } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import type { V3BridgeSpawnRequestProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"

// Creep
export type EnergyHarvestRoomProcessCreepRoles = "worker" | "claimer" | "distributor" | "puller"
export type EnergyHarvestRoomProcessCreepMemoryExtension = {
  tempState: "harvesting" | "working" // FixMe: タスク管理に移す
}
export type EnergyHarvestRoomProcessCreep = TaskDrivenCreep<EnergyHarvestRoomProcessCreepRoles, EnergyHarvestRoomProcessCreepMemoryExtension>
export type EnergyHarvestRoomProcessCreepMemory = TaskDrivenCreepMemory<EnergyHarvestRoomProcessCreepRoles> & EnergyHarvestRoomProcessCreepMemoryExtension


// Types
export type EnergyHarvestRoomProcessDependency = Pick<V3BridgeSpawnRequestProcessApi, "addSpawnRequest">
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi
  & Partial<BotApi>

// import { OwnedRoomPlan, RemoteHarvestRoomPlan } from "application/task/worker/room_plan/room_plan"
import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import { ShortVersion, ShortVersionV6 } from "utility/system_info"

type ResourceInsufficiencyPriorityRequired = 0
type ResourceInsufficiencyPriorityOptional = 1
const resourceInsufficiencyPriorityRequired: ResourceInsufficiencyPriorityRequired = 0
const resourceInsufficiencyPriorityOptional: ResourceInsufficiencyPriorityOptional = 1
export type ResourceInsufficiencyPriority = ResourceInsufficiencyPriorityRequired | ResourceInsufficiencyPriorityOptional
export const ResourceInsufficiencyPriority = {
  Required: resourceInsufficiencyPriorityRequired,
  Optional: resourceInsufficiencyPriorityOptional,
}

export interface BasicRoomInfo {
  readonly v: ShortVersionV6
  readonly roomType: "normal" | "owned"

  // ---- Structure ---- //
  readonly energySourceStructureIds: Id<EnergySource>[]
  readonly energyStoreStructureIds: Id<EnergyStore>[]
}

export interface NormalRoomInfo extends BasicRoomInfo {
  readonly roomType: "normal"
  // roomPlan: RemoteHarvestRoomPlan | null
}

/**
 * - エネルギーの充填優先度として平準化する
 *   - 低い順にterminal, storage,
 */
export interface OwnedRoomInfo extends BasicRoomInfo {
  readonly roomType: "owned"

  // ---- Room Plan ---- //
  // readonly roomPlan: OwnedRoomPlan

  // ---- Structure ---- //
  readonly chargeStructureIds: Id<EnergyChargeableStructure>[]
  researchLab?: {
    readonly inputLab1: Id<StructureLab>
    readonly inputLab2: Id<StructureLab>
    readonly outputLabs: Id<StructureLab>[]
  }
  highestRcl: number

  // ---- Inter Room ---- //
  // TODO: 同様にCreepも送れるようにする
  readonly resourceInsufficiencies: { [K in ResourceConstant]?: ResourceInsufficiencyPriority }

  readonly config?: {
    disablePowerHarvesting?: boolean
    disableMineralHarvesting?: boolean
    disableUnnecessaryTasks?: boolean
    enableOperateSpawn?: boolean
    researchCompounds?: { [index in MineralCompoundConstant]?: number }
  }
}

export type RoomInfoType = NormalRoomInfo | OwnedRoomInfo

export function buildOwnedRoomInfo(normalRoomInfo?: NormalRoomInfo): OwnedRoomInfo {
  return {
    v: ShortVersion.v6,
    roomType: "owned",
    chargeStructureIds: [],
    energySourceStructureIds: normalRoomInfo?.energySourceStructureIds ?? [],
    energyStoreStructureIds: normalRoomInfo?.energyStoreStructureIds ?? [],
    resourceInsufficiencies: {},
    highestRcl: 1,
  }
}

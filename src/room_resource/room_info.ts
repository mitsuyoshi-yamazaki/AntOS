import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import type { ShortVersionV6 } from "utility/system_info"

/**
 * - エネルギーの充填優先度として平準化する
 *   - 低い順にterminal, storage,
 */
export interface RoomInfo {
  readonly v: ShortVersionV6

  // ---- Structure ---- //
  readonly chargeStructureIds: Id<EnergyChargeableStructure>[]
  readonly energySourceStructureIds: Id<EnergySource>[]
  readonly energyStoreStructureIds: Id<EnergyStore>[]
}

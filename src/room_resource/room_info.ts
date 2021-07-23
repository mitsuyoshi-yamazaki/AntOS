import type { EnergyChargeableStructure, EnergySource, EnergyStore } from "prototype/room_object"
import type { ShortVersionV6 } from "utility/system_info"

export interface RoomInfo {
  readonly v: ShortVersionV6
  readonly chargeStructureIds: Id<EnergyChargeableStructure>[]
  readonly energySourceStructureIds: Id<EnergySource>[]
  readonly energyStoreStructureIds: Id<EnergyStore>[]
}

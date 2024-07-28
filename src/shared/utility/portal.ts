import { RoomName } from "./room_name_types"

export type InterShardPortal = Omit<StructurePortal, "destination"> & {
  readonly destination: {
    readonly shard: string
    readonly room: RoomName
  }
}
export const isInterShardPortal = (portal: StructurePortal): portal is InterShardPortal => !(portal.destination instanceof RoomPosition)

export type IntraShardPortal = Omit<StructurePortal, "destination"> & {
  readonly destination: RoomPosition
}
export const isIntraShardPortal = (portal: StructurePortal): portal is IntraShardPortal => portal.destination instanceof RoomPosition

export const findPortalsIn = (room: Room): (InterShardPortal | IntraShardPortal)[] => room.find<StructurePortal>(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_PORTAL } }) as (InterShardPortal | IntraShardPortal)[]

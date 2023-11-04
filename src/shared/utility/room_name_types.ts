export type RoomName = string

export type RoomTypeNormal = "normal"
export type RoomTypeHighway = "highway"
export type RoomTypeHighwayCrossing = "highway_crossing"
export type RoomTypeSourceKeeper = "source_keeper"
export type RoomTypeSectorCenter = "sector_center"
export type RoomType = RoomTypeNormal | RoomTypeHighway | RoomTypeHighwayCrossing | RoomTypeSourceKeeper | RoomTypeSectorCenter

export type RCL = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

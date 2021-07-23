export type ResourcefulRoomType = "owned" | "normal" | "source_keeper" | "highway"

export interface RoomResource {
   room: Room
   roomType: ResourcefulRoomType
}

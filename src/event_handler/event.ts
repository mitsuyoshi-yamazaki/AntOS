import { CreepName } from "prototype/creep"
import { RoomName } from "utility/room_name"

export type EventType = "room visibility"
  | "creep dead"

export type Event = RoomVisibleEvent
 | CreepDeadEvent

export type EventSpecifier = {
  readonly eventType: EventType
  readonly identifier: string
}

export type RoomVisibleEvent = {
  readonly eventType: "room visibility"
  readonly roomName: RoomName
  readonly room: Room | null
}

export type CreepDeadEvent = {
  readonly eventType: "creep dead"
  readonly creepName: CreepName
}

export const EventSpecifierMaker = {
  roomVisibleEvent(roomName: RoomName): EventSpecifier {
    return {
      eventType: "room visibility",
      identifier: roomName,
    }
  },
  creepDeadEvent(creepName: CreepName): EventSpecifier {
    return {
      eventType: "creep dead",
      identifier: creepName,
    }
  },
}

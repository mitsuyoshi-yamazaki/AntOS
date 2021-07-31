import { TaskTargetCacheTaskType } from "object_task/object_task_target_cache"
import { RoomName } from "utility/room_name"

const roomEventsCache = new Map<RoomName, EventItem[]>()
const objectEventsCache = new Map<Id<AnyCreep | AnyStructure>, EventItem[]>()

export const RoomEventCache = {
  beforeTick(): void {
    roomEventsCache.clear()
    objectEventsCache.clear()
  },

  afterTick(): void {

  },

  // taskPerformance(creep: Creep, taskType: TaskTargetCacheTaskType): number {
  //   const events = roomEvents(creep.room)

  // },
}

function roomEvents(room: Room): EventItem[] {
  const stored = roomEventsCache.get(room.name)
  if (stored != null) {
    return stored
  }
  const events = room.getEventLog()
  roomEventsCache.set(room.name, events)
  return events
}

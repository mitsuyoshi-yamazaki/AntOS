import { RoomName } from "shared/utility/room_name"

export type RoomEventCacheCreepTaskType = "repair"

type AnyObject = AnyCreep | AnyStructure

type DamageEvent = {
  attackerIds: Id<AnyObject>[]
  damage: number
}
type RepairEvent = {
  energySpent: number
}

export type ObjectEvent = {
  damage?: DamageEvent
  repair?: RepairEvent
}

const roomEventsCache = new Map<RoomName, Map<Id<AnyObject>, ObjectEvent>>()

export const RoomEventCache = {
  beforeTick(): void {
    roomEventsCache.clear()
  },

  afterTick(): void {

  },

  creepPerformance(creep: Creep, taskType: RoomEventCacheCreepTaskType): number {
    const objectEvent = getObjectEvent(creep)
    if (objectEvent == null) {
      return 0
    }
    switch (taskType) {
    case "repair":
      return objectEvent.repair?.energySpent ?? 0
    }
  },
}

function getObjectEvent(obj: AnyObject): ObjectEvent | null {
  if (obj.room == null) {
    return null
  }
  const storedRoomEvents = roomEventsCache.get(obj.room.name)
  if (storedRoomEvents != null) {
    return storedRoomEvents.get(obj.id) ?? null
  }

  const newRoomEvents = new Map<Id<AnyObject>, ObjectEvent>()
  roomEventsCache.set(obj.room.name, newRoomEvents)
  const objectEvent = ((id: Id<AnyObject>): ObjectEvent => {
    const stored = newRoomEvents.get(id)
    if (stored != null) {
      return stored
    }
    const newEvent: ObjectEvent = {}
    newRoomEvents.set(id, newEvent)
    return newEvent
  })

  obj.room.getEventLog().forEach(eventLog => {
    const objectId = eventLog.objectId as Id<AnyObject>

    switch (eventLog.event) {
    case EVENT_ATTACK: {
      const targetId = eventLog.data.targetId as Id<AnyObject>
      const event = objectEvent(targetId)
      if (event.damage == null) {
        event.damage = {
          attackerIds: [],
          damage: 0,
        }
      }
      event.damage.attackerIds.push(objectId)
      event.damage.damage += eventLog.data.damage
      break
    }
    case EVENT_OBJECT_DESTROYED:
    case EVENT_ATTACK_CONTROLLER:
    case EVENT_BUILD:
    case EVENT_HARVEST:
    case EVENT_HEAL:
      break // TODO:

    case EVENT_REPAIR: {
      const event = objectEvent(objectId)
      if (event.repair == null) {
        event.repair = {
          energySpent: 0
        }
      }
      event.repair.energySpent += eventLog.data.energySpent
      break
    }
    case EVENT_RESERVE_CONTROLLER:
    case EVENT_UPGRADE_CONTROLLER:
    case EVENT_EXIT:
    case EVENT_TRANSFER:
      break // TODO:
    }
  })

  return newRoomEvents.get(obj.id) ?? null
}

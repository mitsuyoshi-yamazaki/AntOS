import { EventObserver } from "event_handler/event_manager"
import { RoomName } from "utility/room_name"

export type EventRoomVisibilityMemory = {  // TODO: v6RoomInfoとは独立しているがアーキテクチャが固まったら統合しても良い
  observingVisibleRooms: RoomName[]
}

export function observeRoomVisibility(observers: Map<RoomName, EventObserver[]>): void {
  const observingRooms = Array.from(observers.keys())

  const roomsBecameVisible: Room[] = []
  const roomsBecameInvisible: RoomName[] = []
  const observingVisibleRooms: RoomName[] = []

  observingRooms.forEach(roomName => {
    const wasVisible = Memory.eventMemory.roomVisibility.observingVisibleRooms.includes(roomName) === true
    const room = Game.rooms[roomName]
    if (room != null) {
      if (wasVisible !== true) {
        roomsBecameVisible.push(room)
      }
      observingVisibleRooms.push(roomName)
    } else {
      if (wasVisible === true) {
        roomsBecameInvisible.push(roomName)
      }
    }
  })

  Memory.eventMemory.roomVisibility.observingVisibleRooms = observingVisibleRooms

  roomsBecameVisible.forEach(room => {
    const observerList = observers.get(room.name)
    if (observerList == null) {
      return
    }
    observerList.forEach(observer => {
      observer.didReceiveEvent({
        eventType: "room visibility",
        room,
        roomName: room.name,
      })
    })
  })

  roomsBecameInvisible.forEach(roomName => {
    const observerList = observers.get(roomName)
    if (observerList == null) {
      return
    }
    observerList.forEach(observer => {
      observer.didReceiveEvent({
        eventType: "room visibility",
        room: null,
        roomName,
      })
    })
  })
}

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ValuedMapArrayMap } from "utility/valued_collection"
import { Event, EventSpecifier, EventType } from "./event"
import { observeRoomVisibility } from "./event_watcher/room_visibility_event_watcher"

export type EventObserverIdentifier = string

export interface EventObserver {
  readonly identifier: EventObserverIdentifier

  didReceiveEvent(event: Event): void
}

const observers = new ValuedMapArrayMap<EventType, string, EventObserver>()

// TODO: Memoryからのリストア
export const EventManager = {
  beforeTick(): void {

  },

  afterTick(): void {

  },

  run(): void { // TODO: どこかから呼び出す
    observeRoomVisibility(observers.getValueFor("room visibility"))
  },

  addObserver(observer: EventObserver, eventSpecifier: EventSpecifier): void {
    observers.getValueFor(eventSpecifier.eventType).getValueFor(eventSpecifier.identifier).push(observer)
  },

  removeObserver(observer: EventObserver, eventSpecifier: EventSpecifier): void {
    const observerMap = observers.getValueFor(eventSpecifier.eventType)
    const observerList = observerMap.getValueFor(eventSpecifier.identifier)
    const index = observerList.indexOf(observer)
    if (index < 0) {
      PrimitiveLogger.programError(`EventManager.removeObserver() unknown observer: ${observer} for event: ${eventSpecifier.eventType}, identifier: ${eventSpecifier.identifier}`)
      return
    }
    observerList.splice(index, 1)
  },
}

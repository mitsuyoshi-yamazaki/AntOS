
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { strictEntries } from "shared/utility/strict_entries"
import type { Mutable } from "shared/utility/types"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import { SystemCall } from "../../system_call"
import { ProcessManager, setNotificationManagerDelegate } from "../process_manager/process_manager"
import { ProcessManagerProcessDidKillNotification, processManagerProcessDidKillNotification } from "../process_manager/process_manager_notification"
import { Notification } from "./notification_manager_types"

export type NotificationReceiver = {
  didReceiveNotification(notification: Notification): void
}

type NotificationManagerMemory = {
  readonly observers: { [EventName: string]: AnyProcessId[] }
}

const initializeMemory = (memory: NotificationManagerMemory): NotificationManagerMemory => {
  const mutableMemroy = memory as Mutable<NotificationManagerMemory>

  if (mutableMemroy.observers == null) {
    mutableMemroy.observers = {}
  }

  return mutableMemroy
}

let notificationManagerMemory: NotificationManagerMemory = {} as NotificationManagerMemory
const notificationEventsByProcessId = new ValuedArrayMap<AnyProcessId, string>()
const systemCallEventObservers = new Map<string, NotificationReceiver[]>() // EventName, NotificationReceiver[]


type NotificationManager = {
  addObserver(process: AnyProcess & NotificationReceiver, eventName: string): void
  removeObserverFor(processId: AnyProcessId, eventName: string): void
  removeObserver(processId: AnyProcessId): void

  send(notification: Notification): void
}

export const NotificationManager: SystemCall<"NotificationManager", NotificationManagerMemory> & NotificationManager = {
  name: "NotificationManager",
  [Symbol.toStringTag]: "NotificationManager",

  load(memory: NotificationManagerMemory): void {
    notificationManagerMemory = initializeMemory(memory)
    clearNotObservedEvents()

    setNotificationManagerDelegate(notification => this.send(notification))
    PrimitiveNotificationManager.addObserver(processWatcher, processManagerProcessDidKillNotification)
  },

  startOfTick(): void {
  },

  endOfTick(): NotificationManagerMemory {
    return notificationManagerMemory
  },

  // NotificationManager
  addObserver(process: AnyProcess & NotificationReceiver, eventName: string): void {
    const processId = process.processId
    const observers = getEventObservers(eventName)
    if (observers.includes(processId) === true) {
      return
    }

    notificationEventsByProcessId.getValueFor(processId).push(eventName)
    observers.push(processId)
  },

  removeObserverFor(processId: AnyProcessId, eventName: string): void {
    const observers = notificationManagerMemory.observers[eventName]
    if (observers == null) {
      return
    }

    const index = observers.indexOf(processId)
    if (index >= 0) {
      observers.splice(index, 0)
    }
  },

  removeObserver(processId: AnyProcessId): void {
    const eventNames = notificationEventsByProcessId.get(processId)
    if (eventNames == null) {
      return
    }

    eventNames.forEach(eventName => {
      this.removeObserverFor(processId, eventName)
    })
  },

  send(notification: Notification): void {
    ErrorMapper.wrapLoop((): void => {
      const systemCallObservers = systemCallEventObservers.get(notification.eventName)
      if (systemCallObservers != null) {
        systemCallObservers.forEach(observer => {
          ErrorMapper.wrapLoop((): void => {
            observer.didReceiveNotification(notification)
          }, `NotificationManager.send(${observer}, ${notification.eventName})`)()
        })
      }

      const processIds = notificationManagerMemory.observers[notification.eventName]
      if (processIds == null) {
        return
      }

      processIds.forEach(processId => {
        const process = ProcessManager.getProcess(processId) as (AnyProcess & NotificationReceiver) | null
        if (process == null || process.didReceiveNotification == null) {
          return
        }
        const { isRunning } = ProcessManager.getProcessRunningState(processId)
        if (isRunning == null) {
          return
        }

        ErrorMapper.wrapLoop((): void => {
          process.didReceiveNotification(notification)
        }, `NotificationManager.send(${process}, ${notification.eventName})`)()
      })
    }, "NotificationManager.send()")()
  },
}

export const NotificationManagerAccessor = {
  getRegisteredObservers(): Map<string, AnyProcess[]> {
    const result = new Map<string, AnyProcess[]>()

    ;
    (strictEntries(notificationManagerMemory.observers) as [string, AnyProcessId[]][]).forEach(([eventName, processIds]) => {
      const processes = processIds.flatMap((processId): AnyProcess[] => {
        const process = ProcessManager.getProcess(processId)
        if (process == null) {
          return []
        }
        return [process]
      })

      result.set(eventName, processes)
    })

    return result
  },
}

export const PrimitiveNotificationManager = {
  addObserver(observer: NotificationReceiver, eventName: string): void {
    const observers = systemCallEventObservers.get(eventName)
    if (observers != null) {
      observers.push(observer)
      return
    }

    const newObservers: NotificationReceiver[] = [observer]
    systemCallEventObservers.set(eventName, newObservers)
  },
}

const processWatcher: NotificationReceiver = {
  didReceiveNotification(notification: Notification): void {
    switch (notification.eventName) {
    case processManagerProcessDidKillNotification: {
      const didKillNotification = notification as Notification & ProcessManagerProcessDidKillNotification
      NotificationManager.removeObserver(didKillNotification.killedProcessId)
      return
    }
    default:
      return
    }
  },
}

const clearNotObservedEvents = (): void => {
  const notObservedEventNames: string[] = []

  ;
  (strictEntries(notificationManagerMemory.observers) as [string, AnyProcessId[]][]).forEach(([eventName, observers]) => {
    if (observers.length <= 0) {
      notObservedEventNames.push(eventName)
    }
  })

  notObservedEventNames.forEach(eventName => {
    delete notificationManagerMemory.observers[eventName]
  })
}

const getEventObservers = (eventName: string): AnyProcessId[] => {
  const observers = notificationManagerMemory.observers[eventName]
  if (observers != null) {
    return observers
  }

  const newArray: AnyProcessId[] = []
  notificationManagerMemory.observers[eventName] = newArray
  return newArray
}

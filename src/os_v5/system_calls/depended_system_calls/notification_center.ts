
import { ErrorMapper } from "error_mapper/ErrorMapper"
import { AnyProcess, AnyProcessId } from "os_v5/process/process"
import { strictEntries } from "shared/utility/strict_entries"
import type { Mutable } from "shared/utility/types"
import { SystemCall } from "../../system_call"
import { ProcessManager } from "../process_manager/process_manager"

export type NotificationReceiver = {
  didReceiveNotification(notification: Notification): void
}

type NotificationCenterMemory = {
  readonly observers: { [EventName: string]: AnyProcessId[] }
}

const initializeMemory = (memory: NotificationCenterMemory): NotificationCenterMemory => {
  const mutableMemroy = memory as Mutable<NotificationCenterMemory>

  if (mutableMemroy.observers == null) {
    mutableMemroy.observers = {}
  }

  return mutableMemroy
}

let notificationCenterMemory: NotificationCenterMemory = {} as NotificationCenterMemory
const systemCallEventObservers = new Map<string, NotificationReceiver[]>() // EventName, NotificationReceiver[]

type Notification = {
  readonly eventName: string
}


type NotificationCenter = {
  addObserver(process: AnyProcess & NotificationReceiver, eventName: string): void
  removeObserver(process: AnyProcess & NotificationReceiver, eventName: string): void

  send(notification: Notification): void
}

export const NotificationCenter: SystemCall<"NotificationCenter", NotificationCenterMemory> & NotificationCenter = {
  name: "NotificationCenter",
  [Symbol.toStringTag]: "NotificationCenter",

  load(memory: NotificationCenterMemory): void {
    notificationCenterMemory = initializeMemory(memory)
    clearNotObservedEvents()
  },

  startOfTick(): void {
  },

  endOfTick(): NotificationCenterMemory {
    return notificationCenterMemory
  },

  // NotificationCenter
  addObserver(process: AnyProcess & NotificationReceiver, eventName: string): void {
    const processId = process.processId
    const observers = getEventObservers(eventName)
    if (observers.includes(processId) === true) {
      return
    }
    observers.push(processId)
  },

  removeObserver(process: AnyProcess & NotificationReceiver, eventName: string): void {
    const observers = notificationCenterMemory.observers[eventName]
    if (observers == null) {
      return
    }

    const index = observers.indexOf(process.processId)
    if (index >= 0) {
      observers.splice(index, 0)
    }
  },

  send(notification: Notification): void {
  // TODO: system call のobserver
    const systemCallObservers = systemCallEventObservers.get(notification.eventName)
    if (systemCallObservers != null) {
      systemCallObservers.forEach(observer => {
        ErrorMapper.wrapLoop((): void => {
          observer.didReceiveNotification(notification)
        }, `NotificationCenter.send(${observer}, ${notification.eventName})`)()
      })
    }

    const processIds = notificationCenterMemory.observers[notification.eventName]
    if (processIds == null) {
      return
    }

    processIds.forEach(processId => {
      ErrorMapper.wrapLoop((): void => {
        const process = ProcessManager.getProcess(processId) as (AnyProcess & NotificationReceiver) | null
        if (process == null || process.didReceiveNotification == null) {
          return
        }
        const { isRunning } = ProcessManager.getProcessRunningState(processId)
        if (isRunning == null) {
          return
        }

        process.didReceiveNotification(notification)

      }, `NotificationCenter.send(${process}, ${notification.eventName})`)()
    })
  },
}

export const NotificationCenterSystemCall = {
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

const clearNotObservedEvents = (): void => {
  const notObservedEventNames: string[] = []

  ;
  (strictEntries(notificationCenterMemory.observers) as [string, AnyProcessId[]][]).forEach(([eventName, observers]) => {
    if (observers.length <= 0) {
      notObservedEventNames.push(eventName)
    }
  })

  notObservedEventNames.forEach(eventName => {
    delete notificationCenterMemory.observers[eventName]
  })
}

const getEventObservers = (eventName: string): AnyProcessId[] => {
  const observers = notificationCenterMemory.observers[eventName]
  if (observers != null) {
    return observers
  }

  const newArray: AnyProcessId[] = []
  notificationCenterMemory.observers[eventName] = newArray
  return newArray
}

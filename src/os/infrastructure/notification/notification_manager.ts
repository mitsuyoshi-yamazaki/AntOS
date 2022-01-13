import { ValuedMapArrayMap } from "utility/valued_collection"
import { PrimitiveLogger } from "../primitive_logger"

type ObserverIdentifier = string
type NotificationName = string
type NotificationCategory = string

export type NotificationMemory = {
  observers: { [notificationName: string]: {[notificationCategory: string]: string[]}}
}

export type Notification = {
  readonly notificationName: NotificationName
  readonly notificationCategory: NotificationCategory | null
}

export interface Observer {
  readonly observerIdentifier: ObserverIdentifier

  notify(notification: Notification): void
}

const observers = new ValuedMapArrayMap<NotificationName, NotificationCategory, ObserverIdentifier>()
const observerStore = new Map<ObserverIdentifier, Observer>()

export const NotificationManager = {
  restore(memory: NotificationMemory): { restoredObserverIdentifiers: ObserverIdentifier[], restoreObserver: (observer: Observer) => void } {
    const restoredObserverIdentifiers: ObserverIdentifier[] = []

    Object.entries(memory.observers).forEach(([notificationName, restoredObserverList]) => {
      const observerList = observers.getValueFor(notificationName)

      Object.entries(restoredObserverList).forEach(([notificationCategory, restoredCategoryObservers]) => {
        observerList.set(notificationCategory, restoredCategoryObservers)

        restoredCategoryObservers.forEach(observerIdentifier => {
          if (restoredObserverIdentifiers.includes(observerIdentifier) === true) {
            return
          }
          restoredObserverIdentifiers.push(observerIdentifier)
        })
      })
    })
    return {
      restoredObserverIdentifiers: [...restoredObserverIdentifiers],
      restoreObserver: observer => {
        if (restoredObserverIdentifiers.includes(observer.observerIdentifier) !== true) {
          return
        }
        observerStore.set(observer.observerIdentifier, observer)
      },
    }
  },

  beforeTick(): void {
  },

  afterTick(): NotificationMemory {
    return store()
  },

  addObserver(observer: Observer, notificationName: NotificationName, notificationSpecifier: NotificationCategory | null): void {
    const observerIdentifier = observer.observerIdentifier
    if (observerStore.has(observerIdentifier) !== true) {
      observerStore.set(observerIdentifier, observer)
    }
    observers.getValueFor(notificationName).getValueFor(`${notificationSpecifier}`).push(observerIdentifier)
  },

  removeObserver(observerIdentifier: ObserverIdentifier, notificationName: NotificationName, notificationSpecifier: NotificationCategory | null): void {
    const observerList = observers.getValueFor(notificationName).getValueFor(`${notificationSpecifier}`)
    const index = observerList.indexOf(observerIdentifier)
    if (index < 0) {
      PrimitiveLogger.programError(`NotificationManager.removeObserver() unregistered observer; ${observerIdentifier}`)
      return
    }
    observerList.splice(index, 1)
  },

  removeObserverInstance(observer: Observer): void {
    observerStore.delete(observer.observerIdentifier)
  },

  postNotification(notification: Notification): void {
    const observerList = observers.getValueFor(notification.notificationName).getValueFor(`${notification.notificationCategory}`)
    const observerIteration = [...observerList].reverse()
    observerIteration.forEach((observerIdentifier, index) => {
      const observer = observerStore.get(observerIdentifier)
      if (observer == null) {
        observerList.splice(index, 1)
        return
      }
      observer.notify(notification)
    })
  },
}

function store(): NotificationMemory {
  const storeObservers: { [notificationName: string]: { [notificationCategory: string]: string[] } } = {}
  const subscribingObserverIdentifiers = Array.from(observerStore.keys())

  observers.forEach((observerList, notificationName) => {
    const storeCategoryObservers: { [notificationCategory: string]: string[] } = {}
    let hasObservers = false as boolean

    observerList.forEach((categoryObservers, notificationCategory) => {
      const subscribing = categoryObservers.filter(observerIdentifier => subscribingObserverIdentifiers.includes(observerIdentifier))
      if (subscribing.length <= 0) {
        return
      }
      hasObservers = true
      storeCategoryObservers[notificationCategory] = subscribing
    })

    if (hasObservers !== true) {
      return
    }
    storeObservers[notificationName] = storeCategoryObservers
  })

  return {
    observers: storeObservers,
  }
}

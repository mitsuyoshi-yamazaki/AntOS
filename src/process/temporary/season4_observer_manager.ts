import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomResources } from "room_resource/room_resources"
import { coloredText, roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { Timestamp } from "utility/timestamp"
import { ValuedMapMap } from "utility/valued_collection"

type ObserveInterval = "short" | "medium" | "long"

type ObserveRequestArguments = {
  readonly observerRoomName: RoomName
  readonly targetRoomName: RoomName
  readonly interval: ObserveInterval
  readonly concectiveTicks: number
}
type ObserveRequest = {
  readonly observerRoomName: RoomName
  readonly observerId: Id<StructureObserver>
  readonly observeRoomNames: {
    readonly short: RoomName[]
    readonly medium: RoomName[]
    readonly long: RoomName[]
  }
}
type Observation = {
  readonly request: ObserveRequest
  observeTable: RoomName[]
  index: number
}

const observations = new Map<RoomName, Observation>() // <observerRoomName, observation>
const reserved = new ValuedMapMap<RoomName, Timestamp, RoomName>() // <observerRoomName, observeTime, targetRoomName>
const requestArguments: ObserveRequestArguments[] = []

export const Season4ObserverManager = {
  beforeTick(): void {
  },

  afterTick(): void {
    recalculateObservation()
    observe()

    requestArguments.splice(0, requestArguments.length)
  },

  addRequest(observerRoomName: RoomName, targetRoomName: RoomName, interval: ObserveInterval, concectiveTicks: number): void {
    requestArguments.push({
      observerRoomName,
      targetRoomName,
      interval,
      concectiveTicks,
    })
  },

  reserveObservation(observerRoomName: RoomName, targetRoomName: RoomName, ticksAfter: Timestamp, options?: {retry?: boolean}): void {
    const reservationMap = reserved.getValueFor(observerRoomName)
    const observeTime = Game.time + ticksAfter
    const observeRoomName = reservationMap.get(observeTime)
    if (observeRoomName === targetRoomName) {
      return
    }
    if (observeRoomName != null) {
      if (options?.retry === true) {
        const retryTime = observeTime + 1
        const retryObserveRoomName = reservationMap.get(retryTime)
        if (retryObserveRoomName === targetRoomName) {
          return
        }
        if (retryObserveRoomName != null) {
          PrimitiveLogger.log(`observation reservation for ${roomLink(observerRoomName)} to ${roomLink(targetRoomName)} at ${observeTime} failed`)
          return
        }

        reservationMap.set(retryTime, targetRoomName)
        return

      } else {
        PrimitiveLogger.log(`observation reservation for ${roomLink(observerRoomName)} to ${roomLink(targetRoomName)} at ${observeTime} failed`)
        return
      }
    }

    reservationMap.set(observeTime, targetRoomName)
  },

  // 一旦デプロイでクリアされるため不要
  // stopObserving(roomName: RoomName, requesterIdentifier: string): void {
  // },
}

function recalculateObservation(): void {
  const observeTargetChangedRoomNames: RoomName[] = []

  requestArguments.forEach(args => {
    const request = getRequestFor(args.observerRoomName)
    if (request == null) {
      return
    }
    observeTargetChangedRoomNames.push(request.observerRoomName)
    addObserveTargetTo(request, args.targetRoomName, args.interval, args.concectiveTicks)
  })

  observations.forEach(observation => {
    if (observeTargetChangedRoomNames.includes(observation.request.observerRoomName) !== true) {
      return
    }
    observation.observeTable = createObservationTableFrom(observation.request)
    observation.index = observation.index % observation.observeTable.length
  })
}

function createObservationTableFrom(request: ObserveRequest): RoomName[] {
  const result: RoomName[] = [
    ...request.observeRoomNames.short,
    ...request.observeRoomNames.medium,
    ...request.observeRoomNames.short,
    ...request.observeRoomNames.long,
    ...request.observeRoomNames.short,
    ...request.observeRoomNames.medium,
  ]
  return result
}

function getRequestFor(observerRoomName: RoomName): ObserveRequest | null {
  const stored = observations.get(observerRoomName)
  if (stored != null) {
    return stored.request
  }
  const roomResource = RoomResources.getOwnedRoomResource(observerRoomName)
  const observer = roomResource?.activeStructures.observer
  if (observer == null) {
    PrimitiveLogger.programError(`${roomLink(observerRoomName)} has no observer`)
    return null
  }

  const newRequest: ObserveRequest = {
    observerRoomName,
    observerId: observer.id,
    observeRoomNames: {
      short: [],
      medium: [],
      long: [],
    }
  }
  const observation: Observation = {
    request: newRequest,
    observeTable: [], // recalculateObservation() で値が入る
    index: 0,
  }
  observations.set(observerRoomName, observation)
  return newRequest
}

function addObserveTargetTo(request: ObserveRequest, targetRoomName: RoomName, interval: ObserveInterval, concectiveTicks: number): void {
  let added = false as boolean
  const checkListFor = (checkInterval: ObserveInterval): void => {
    const list = getObserveRoomListFor(request, checkInterval)
    if (checkInterval === interval) {
      const targetRoomNameCount = list.filter(roomName => roomName === targetRoomName).length
      const addRoomNameCount = concectiveTicks - targetRoomNameCount
      if (addRoomNameCount <= 0) {
        added = true
        return
      }
      const targetRoomNameIndex = ((): number => {
        const index = list.findIndex(roomName => roomName === targetRoomName)
        if (index < 0) {
          return 0
        }
        return index
      })()
      Array(addRoomNameCount).fill(0).forEach(() => {
        list.splice(targetRoomNameIndex, 0, targetRoomName)
      })
      added = true
      return
    }

    if (added === true) {
      const removeIndices = list.flatMap((roomName, index) => {
        if (roomName === targetRoomName) {
          return [index]
        }
        return []
      })
      removeIndices.reverse()
      removeIndices.forEach(index => list.splice(index, 1))
    }
  }

  const allIntervals: ObserveInterval[] = [
    "short",
    "medium",
    "long",
  ]
  allIntervals.forEach(checkInterval => {
    checkListFor(checkInterval)
  })
}

function getObserveRoomListFor(request: ObserveRequest, interval: ObserveInterval): RoomName[] {
  switch (interval) {
  case "short":
    return request.observeRoomNames.short
  case "medium":
    return request.observeRoomNames.medium
  case "long":
    return request.observeRoomNames.long
  }
}

function observe(): void {
  const skipRoomNames: RoomName[] = []
  const time = Game.time
  reserved.forEach((reservationMap, roomName) => {
    const reservedTargetRoomName = reservationMap.get(time)
    if (reservedTargetRoomName == null) {
      return
    }

    const roomResource = RoomResources.getOwnedRoomResource(roomName)
    const observer = roomResource?.activeStructures.observer
    if (observer == null) {
      PrimitiveLogger.programError(`${roomLink(roomName)} has no observer`)
      return
    }

    observeRoom(observer, reservedTargetRoomName)
    reservationMap.delete(time)
  })


  observations.forEach(observation => {
    if (skipRoomNames.includes(observation.request.observerRoomName) === true) {
      return
    }
    const observer = Game.getObjectById(observation.request.observerId)
    if (observer == null) {
      return
    }

    const nextTargetRoomName = observation.observeTable[observation.index]
    if (nextTargetRoomName != null) {
      observeRoom(observer, nextTargetRoomName)
    }
    observation.index = (observation.index + 1) % observation.observeTable.length
  })
}

function observeRoom(observer: StructureObserver, targetRoomName: RoomName): void {
  const result = observer.observeRoom(targetRoomName)
  switch (result) {
  case OK:
    break
  case ERR_NOT_OWNER:
  case ERR_NOT_IN_RANGE:
  case ERR_INVALID_ARGS:
  case ERR_RCL_NOT_ENOUGH:
    PrimitiveLogger.programError(`${coloredText("[Error]", "error")} observer.observeRoom(${roomLink(targetRoomName)}) in ${roomLink(observer.room.name)} failed with ${result}`)
    break
  }
}

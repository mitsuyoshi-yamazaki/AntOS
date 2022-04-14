import { validateRoomNameArgument } from "os/infrastructure/console_command/utility/string_parser"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredResourceType, profileLink, roomLink } from "utility/log"
import { isResourceConstant } from "utility/resource"
import { RoomName } from "utility/room_name"

const segmentID = 90
const allyList = Memory.gameInfo.whitelist

// Priority convention:
// 1: I really need this or I'm going to die
// 0: That'd be nice I guess maybe if you really don't mind.
// Everything in between: everything in betweeen
type RequestPriority = number

type RequestTypeResource = 0
type RequestTypeDefense = 1
type RequestTypeAttack = 2
type RequestTypeExecute = 3
type RequestTypeHate = 4
const requestTypeResource: RequestTypeResource = 0
const requestTypeDefense: RequestTypeDefense = 1
const requestTypeAttack: RequestTypeAttack = 2
const requestTypeExecute: RequestTypeExecute = 3
const requestTypeHate: RequestTypeHate = 4

type PlayerName = string

type RequestResource = {
  readonly requestType: RequestTypeResource
  readonly roomName: RoomName
  readonly priority: RequestPriority
  readonly resourceType: ResourceConstant
  readonly maxAmount: number
}
type RequestDefense = {
  readonly requestType: RequestTypeDefense
  readonly roomName: RoomName
  readonly priority: RequestPriority
}
type RequestAttack = {
  readonly requestType: RequestTypeAttack
  readonly roomName: RoomName
  readonly priority: RequestPriority
  readonly playerName: PlayerName
}
type RequestExecute = {
  readonly requestType: RequestTypeExecute
  readonly priority: RequestPriority
  // not implemented
}
type RequestHate = {
  readonly requestType: RequestTypeHate
  readonly playerName: PlayerName
  readonly priority: RequestPriority
}
type Request = RequestResource | RequestDefense | RequestAttack | RequestExecute | RequestHate

let myRequests: Request[] = []
const currentRequests = new Map<PlayerName, { requests: Request[], invalidRequests: {request: unknown, reason: string}[]}>()

interface SwcAllyRequestInterface {
  beforeTick(): void
  afterTick(): void

  // Request from ally
  getRequests(): { request: Request, allyName: PlayerName }[]
  getInvalidRequests(): Map<PlayerName, {request: unknown, reason: string}[]>

  // Request to ally
  requestAttack(roomName: RoomName, playerName: PlayerName, priority?: RequestPriority): void
  requestHelp(roomName: RoomName, priority?: RequestPriority): void
  requestHate(playerName: PlayerName, priority?: RequestPriority): void
  requestResource(roomName: RoomName, resourceType: ResourceConstant, maxAmount: number, priority?: RequestPriority): void

  // Utility
  describeRequest(request: Request): string
}

export const SwcAllyRequest: SwcAllyRequestInterface = {
  beforeTick(): void {
    myRequests = []
    checkAllies()
  },

  afterTick(): void {
    if (Object.keys(RawMemory.segments).length < 10) {
      RawMemory.segments[segmentID] = JSON.stringify(myRequests)
      // If you're already setting public segements somewhere this will overwrite that. You should
      // fix that yourself because I can't fix it for you.
      RawMemory.setPublicSegments([segmentID])
    }
  },

  getRequests(): { request: Request, allyName: PlayerName }[] {
    return Array.from(currentRequests.entries()).flatMap(([allyName, requests]): { request: Request, allyName: PlayerName }[] => {
      return requests.requests.map(request => {
        return {
          allyName,
          request,
        }
      })
    })
  },

  getInvalidRequests(): Map<PlayerName, { request: unknown, reason: string }[]> {
    const results = new Map < PlayerName, { request: unknown, reason: string }[]>()

    Array.from(currentRequests.entries()).forEach(([allyName, requests]) => {
      results.set(allyName, [...requests.invalidRequests])
    })

    return results
  },

  requestAttack(roomName: RoomName, playerName: PlayerName, priority?: RequestPriority): void {
    const request: RequestAttack = {
      requestType: requestTypeAttack,
      roomName: roomName,
      priority: priority == null ? 0 : priority,
      playerName: playerName
    }
    myRequests.push(request)

    if (Game.time % 10 === 0) {
      console.log(roomName, "requesting attack", "priority", priority)
    }
  },

  requestHelp(roomName: RoomName, priority?: RequestPriority): void {
    const request: RequestDefense = {
      requestType: requestTypeDefense,
      roomName: roomName,
      priority: priority == null ? 0 : priority
    }
    myRequests.push(request)

    if (Game.time % 10 === 0) {
      console.log(roomName, "requesting help", "priority", priority)
    }
  },

  requestHate(playerName: PlayerName, priority?: RequestPriority): void {
    const request: RequestHate = {
      requestType: requestTypeHate,
      playerName: playerName,
      priority: priority === undefined ? 0 : priority
    }
    myRequests.push(request)

    if (Game.time % 10 === 0) {
      console.log(playerName, "requesting Hait", "priority", priority)
    }
  },

  requestResource(roomName: RoomName, resourceType: ResourceConstant, maxAmount: number, priority?: RequestPriority): void {
    const request: RequestResource = {
      requestType: requestTypeResource,
      resourceType: resourceType,
      maxAmount: maxAmount,
      roomName: roomName,
      priority: priority === undefined ? 0 : priority
    }
    if (Game.time % 10 === 0) {
      console.log(roomName, "requesting", resourceType, "max amount", maxAmount, "priority", priority)
    }
    myRequests.push(request)
  },

  describeRequest(request: Request): string {
    switch (request.requestType) {
    case requestTypeAttack:
      return `[Attack:${request.priority}] ${roomLink(request.roomName)} ${profileLink(request.playerName)}`
    case requestTypeDefense:
      return `[Defense:${request.priority}] ${roomLink(request.roomName)}`
    case requestTypeExecute:
      return `[Execute:${request.priority}]`
    case requestTypeHate:
      return `[Hate:${request.priority}] ${profileLink(request.playerName)}`
    case requestTypeResource:
      return `[Resource:${request.priority}] ${roomLink(request.roomName)} ${request.maxAmount} ${coloredResourceType(request.resourceType)}`
    }
  },
}

// This sets foreign segments. Maybe you set them yourself for some other reason
// Up to you to fix that.
const checkAllies = (): void => {
  if (allyList.length === 0) {
    currentRequests.clear()
    return
  }

  // Only work 10% of the time
  // if (Game.time % (10 * allyList.length) >= allyList.length) {
  if (Game.time % (2 * allyList.length) >= allyList.length) {
    return
  }

  const currentAllyName = allyList[Game.time % allyList.length]
  if (RawMemory.foreignSegment != null && RawMemory.foreignSegment.username === currentAllyName) {
    const allyRequests = JSON.parse(RawMemory.foreignSegment.data) as ((Partial<Request> | null)[] | null)
    // console.log(currentAllyName, RawMemory.foreignSegment.data)

    if (allyRequests == null) {
      return
    }
    if (!(allyRequests instanceof Array)) {
      PrimitiveLogger.programError(`simpleAllies.checkAllies() invalid ally request format:\n${RawMemory.foreignSegment.data}`)
      return
    }
    // console.log(`${currentAllyName} requests:\n${allyRequests.map(r => JSON.stringify(r)).join("\n")}`)

    const receivedRequests: Request[] = []
    const invalidRequests: { request: unknown, reason: string }[] = []

    allyRequests.forEach(request => {
      if (request == null) {
        invalidRequests.push({
          request,
          reason: "request is null",
        })
        return
      }

      try {
        const validated = validatedRequest(request)
        receivedRequests.push(validated)

      } catch (error) {
        invalidRequests.push({
          request,
          reason: `${error}`,
        })
      }
    })

    currentRequests.set(currentAllyName, {
      requests: receivedRequests,
      invalidRequests,
    })

  } else {
    // console.log("Simple allies either has no segment or has the wrong name?", currentAllyName)
  }

  const nextAllyName = allyList[(Game.time + 1) % allyList.length]
  if (nextAllyName != null) {
    RawMemory.setActiveForeignSegment(nextAllyName, segmentID)
  }
}

/** @throws */
const validatedRequest = (request: Partial<Request>): Request => {
  switch (request.requestType) {
  case requestTypeAttack:
    return {
      requestType: request.requestType,
      priority: validatedPriority(request.priority),
      roomName: validatedRoomName(request.roomName),
      playerName: validatedPlayerName(request.playerName),
    }
  case requestTypeDefense:
    return {
      requestType: request.requestType,
      priority: validatedPriority(request.priority),
      roomName: validatedRoomName(request.roomName),
    }
  case requestTypeResource:
    return {
      requestType: request.requestType,
      priority: validatedPriority(request.priority),
      roomName: validatedRoomName(request.roomName),
      resourceType: validatedResourceType(request.resourceType),
      maxAmount: validatedNumber(request.maxAmount, "maxAmount"),
    }
  case requestTypeExecute:
    return {
      requestType: request.requestType,
      priority: validatedPriority(request.priority),
    }
  case requestTypeHate:
    return {
      requestType: request.requestType,
      priority: validatedPriority(request.priority),
      playerName: validatedPlayerName(request.playerName),
    }
  default:
    throw "missing requestType"
  }
}

/** @throws */
const validatedString = (value: string | undefined, name: string): string => {
  if (value == null || (typeof value !== "string")) {
    throw `${name} is not a string (${value})`
  }
  return value
}

/** @throws */
const validatedResourceType = (resourceType: ResourceConstant | undefined): ResourceConstant => {
  const validated = validatedString(resourceType, "resourceType")
  if (!isResourceConstant(validated)) {
    throw `${validated} is not resource constant`
  }
  return validated
}

/** @throws */
const validatedPlayerName = (playerName: PlayerName | undefined): PlayerName => {
  const validated = validatedString(playerName, "playerName")
  if (validated.length <= 0) {
    throw `invalid playerName ${validated}`
  }
  return validated
}

/** @throws */
const validatedRoomName = (roomName: RoomName | undefined): RoomName => {
  const validated = validatedString(roomName, "roomName")
  if (validated.length <= 0) {
    throw `invalid roomName ${validated}`
  }
  validateRoomNameArgument(validated)
  return validated
}

/** @throws */
const validatedNumber = (value: number | undefined, name: string): number => {
  if (value == null || (typeof value !== "number") || isNaN(value) === true) {
    throw `${name} is not a number (${value})`
  }
  return value
}

/** @throws */
const validatedPriority = (priority: number | undefined): number => {
  const validated = validatedNumber(priority, "priority")
  if (validated < 0 || validated > 1) {
    throw `invalid priority value ${validated}`
  }
  return validated
}

import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { KeywordArguments } from "shared/utility/argument_parser/keyword_argument_parser"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { isCommodityConstant, isDepositConstant, isHarvestableResourceConstant, isMineralBoostConstant } from "shared/utility/resource"
import { coloredResourceType, roomLink } from "utility/log"
import { ResourceManager } from "utility/resource_manager"

/** @throws */
export const execResourceCommand = (args: string[]): string => {
  const commandList = ["help", "room", "collect", "list"]

  const command = args.shift()

  switch (command) {
  case "help":
    return `commands: ${commandList}`
  case "room": {
    const listArguments = new ListArguments(args)
    const resourceType = listArguments.resourceType(0, "resource type").parse()
    const minimumAmount = ((): number | undefined => {
      if (listArguments.has(1) !== true) {
        return undefined
      }
      return listArguments.int(1, "minimum amount").parse({ min: 1 })
    })()
    return resourceInRoom(resourceType, { minimumAmount })
  }
  case "collect": {
    const listArguments = new ListArguments(args)
    const resourceType = listArguments.resourceType(0, "resource type").parse()
    const destinationRoomResource = listArguments.ownedRoomResource(1, "room name").parse()
    const rawAmount = listArguments.string(2, "amount").parse()
    const amount = ((): number | "all" => {
      if (rawAmount === "all") {
        return "all"
      }
      const parsed = parseInt(rawAmount, 10)
      if (isNaN(parsed) === true) {
        throw `invalid amount ${rawAmount}, specify number or "all"`
      }
      return parsed
    })()

    const keywordArguments = new KeywordArguments(args)
    const forced = keywordArguments.boolean("forced").parseOptional() ?? false

    const fromRoomResource = listArguments.has(3) ? listArguments.ownedRoomResource(3, "from room name").parse() : null

    return collectResource(resourceType, destinationRoomResource, amount, fromRoomResource, forced)
  }
  case "list":
    return listResource(args)

  default:
    return `invalid command: ${command}, "help" to show manual`
  }
}

/** @throws */
const listResource = (args: string[]): string => {
  const keywordArguments = new KeywordArguments(args)
  const filteringOptions = ["commodity", "raw", "boost"] as const
  const filteringOption = keywordArguments.stringInList("filter", filteringOptions).parseOptional()
  const filter = ((): (value: [ResourceConstant, number]) => boolean => {
    switch (filteringOption) {
    case "commodity":
      return ([resourceType]) => {
        return isDepositConstant(resourceType) === true || isCommodityConstant(resourceType) === true
      }
    case "raw":
      return ([resourceType]) => {
        return isHarvestableResourceConstant(resourceType) === true
      }
    case "boost":
      return ([resourceType]) => {
        return isMineralBoostConstant(resourceType) === true
      }
    case null:
      return () => true
    }
  })()

  const isLowercase = (value: string): boolean => (value === value.toLocaleLowerCase())
  const resources = Array.from(ResourceManager.list().entries()).filter(filter).sort(([lhs], [rhs]) => {
    const lowerL = isLowercase(lhs)
    const lowerR = isLowercase(rhs)
    if (lowerL === true && lowerR === true) {
      return rhs.length - lhs.length
    }
    if (lowerL === false && lowerR === false) {
      return lhs.length - rhs.length
    }
    return lowerL === true ? -1 : 1
  })
  return resources.map(([resourceType, amount]) => `- ${coloredResourceType(resourceType)}: ${amount}`).join("\n")
}

const resourceInRoom = (resourceType: ResourceConstant, options ?: { minimumAmount?: number }): string => {
  const minimumAmount = options?.minimumAmount ?? 0
  const resourceInRoom = ResourceManager.resourceInRoom(resourceType)
  const results: string[] = [
    `${coloredResourceType(resourceType)}: `,
    ...Array.from(resourceInRoom.entries()).flatMap(([roomName, amount]): string[] => {
      if (amount < minimumAmount) {
        return []
      }
      return [`- ${roomLink(roomName)}: ${amount}`]
    })
  ]
  return results.join("\n")
}

/** @throws */
const collectResource = (resourceType: ResourceConstant, destinationRoomResource: OwnedRoomResource, amount: number | "all", fromRoomResource: OwnedRoomResource | null, forced: boolean): string => {
  if (destinationRoomResource.activeStructures.terminal == null) {
    throw `collectResource() no active terminal found in ${roomLink(destinationRoomResource.room.name)}`
  }
  if (forced !== true) {
    if (amount === "all") {
      const resourceAmount = ResourceManager.amount(resourceType)
      if (destinationRoomResource.activeStructures.terminal.store.getFreeCapacity() <= (resourceAmount + 10000)) {
        throw `collectResource() not enough free space ${roomLink(destinationRoomResource.room.name)} (${resourceAmount} ${coloredResourceType(resourceType)})`
      }
    } else {
      if (destinationRoomResource.activeStructures.terminal.store.getFreeCapacity() <= (amount + 10000)) {
        throw `collectResource() not enough free space ${roomLink(destinationRoomResource.room.name)} (set forced=1 to send anyway)`
      }
    }
  }

  if (fromRoomResource != null) {
    if (fromRoomResource.activeStructures.terminal == null) {
      throw `${roomLink(fromRoomResource.room.name)} has no terminal`
    }
    if (fromRoomResource.activeStructures.terminal.cooldown > 0) {
      throw `terminal in ${roomLink(fromRoomResource.room.name)} under cooldown (${fromRoomResource.activeStructures.terminal.cooldown})`
    }
    const sendAmount = ((): number => {
      const usedAmount = fromRoomResource.activeStructures.terminal.store.getUsedCapacity(resourceType)
      if (usedAmount <= 0) {
        throw `no ${coloredResourceType(resourceType)} in terminal in ${roomLink(fromRoomResource.room.name)}`
      }
      if (amount === "all") {
        return usedAmount
      }
      if (usedAmount < amount) {
        throw `not enough ${coloredResourceType(resourceType)} in terminal in ${roomLink(fromRoomResource.room.name)} (${usedAmount})`
      }
      return amount
    })()
    const result = fromRoomResource.activeStructures.terminal.send(resourceType, sendAmount, destinationRoomResource.room.name)
    switch (result) {
    case OK:
      return `${sendAmount} ${coloredResourceType(resourceType)} sent to ${roomLink(destinationRoomResource.room.name)} from ${roomLink(fromRoomResource.room.name)}`
    default:
      throw `terminal.send(${coloredResourceType(resourceType)}, ${sendAmount}) failed with ${result}`
    }
  }

  const result = ResourceManager.collect(resourceType, destinationRoomResource.room.name, amount)
  switch (result.resultType) {
  case "succeeded":
    return `${result.value} ${coloredResourceType(resourceType)} sent to ${roomLink(destinationRoomResource.room.name)}`
  case "failed":
    throw result.reason.errorMessage
  }
}

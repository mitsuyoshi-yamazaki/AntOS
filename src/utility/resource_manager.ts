import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomResources } from "room_resource/room_resources"
import { coloredResourceType, roomLink } from "./log"
import { MineralConstant } from "./resource"
import { Result, ResultFailed } from "./result"
import { RoomName } from "./room_name"
import { ValuedArrayMap } from "./valued_collection"

let list = null as Map<ResourceConstant, number> | null
let resourceInRoom = null as Map<RoomName, number> | null

interface ResourceManagerInterface {
  beforeTick(): void
  afterTick(): void

  // ---- Mineral ---- //
  /** sourceKeeperは未実装 */ // TODO:
  harvestableMinerals(): { owned: Map<ResourceConstant, RoomName[]>, sourceKeeper: Map<ResourceConstant, RoomName[]>, notHarvestable: ResourceConstant[]}

  // ---- Check Resource Amount ---- //
  list(): Map<ResourceConstant, number>
  amount(resourceType: ResourceConstant): number
  resourceInRoom(resourceType: ResourceConstant): Map<RoomName, number>

  // ---- Send Resource ---- //
  collect(resourceType: ResourceConstant, roomName: RoomName, requiredAmount: number | "all"): Result<number, string>
}

export const ResourceManager: ResourceManagerInterface = {
  beforeTick(): void {
    list = null
    resourceInRoom = null
  },

  afterTick(): void {
  },

  // ---- Mineral ---- //
  harvestableMinerals(): { owned: Map<ResourceConstant, RoomName[]>, sourceKeeper: Map<ResourceConstant, RoomName[]>, notHarvestable: ResourceConstant[] } {
    const owned = new ValuedArrayMap<ResourceConstant, RoomName>()
    const sourceKeeper = new ValuedArrayMap<ResourceConstant, RoomName>()
    const notHarvestable: ResourceConstant[] = [
      ...MineralConstant
    ]

    RoomResources.getOwnedRoomResources().forEach(resources => {
      const roomName = resources.room.name
      resources.room.find(FIND_MINERALS).forEach(mineral => {
        owned.getValueFor(mineral.mineralType).push(roomName)
      })
    })

    const removeHarvestableResourceType = (resourceType: ResourceConstant): void => {
      const index = notHarvestable.indexOf(resourceType)
      if (index < 0) {
        return
      }
      notHarvestable.splice(index, 1)
    }
    owned.forEach((roomName, resourceType) => {
      removeHarvestableResourceType(resourceType)
    })
    sourceKeeper.forEach((roomName, resourceType) => {
      removeHarvestableResourceType(resourceType)
    })

    return {
      owned,
      sourceKeeper,
      notHarvestable,
    }
  },

  // ---- Check Resource Amount ---- //
  list(): Map<ResourceConstant, number> {
    if (list == null) {
      const result = new Map<ResourceConstant, number>()
      RoomResources.getOwnedRoomResources()
        .flatMap(resources => {
          const stores: StoreDefinition[] = []
          if (resources.activeStructures.terminal != null) {
            stores.push(resources.activeStructures.terminal.store)
          }
          if (resources.activeStructures.storage != null) {
            stores.push(resources.activeStructures.storage.store)
          }
          return stores
        })
        .flatMap(store => {
          (Object.keys(store) as ResourceConstant[]).forEach(resourceType => {
            const amount = (result.get(resourceType) ?? 0) + store.getUsedCapacity(resourceType)
            result.set(resourceType, amount)
          })
        })

      list = result
    }
    return new Map(list)
  },

  amount(resourceType: ResourceConstant): number {
    const list = this.list()
    return list.get(resourceType) ?? 0
  },

  resourceInRoom(resourceType: ResourceConstant): Map<RoomName, number> {
    if (resourceInRoom == null) {
      const result = new Map<RoomName, number>()
      RoomResources.getOwnedRoomResources().forEach(resources => {
        const amount = (resources.activeStructures.terminal?.store.getUsedCapacity(resourceType) ?? 0)
          + (resources.activeStructures.storage?.store.getUsedCapacity(resourceType) ?? 0)

        if (amount <= 0) {
          return
        }
        result.set(resources.room.name, amount)
      })
      resourceInRoom = result
    }
    return new Map(resourceInRoom)
  },

  // ---- Send Resource ---- //
  collect(resourceType: ResourceConstant, roomName: RoomName, requiredAmount: number | "all"): Result<number, string> {
    const resourceInRoom = Array.from(this.resourceInRoom(resourceType).entries()).sort(([lhs], [rhs]) => {
      return Game.map.getRoomLinearDistance(roomName, lhs) - Game.map.getRoomLinearDistance(roomName, rhs)
    })

    let sentAmount = 0
    const errorMessages: string[] = []
    resourceInRoom.forEach(([fromRoomName]) => {
      if (fromRoomName === roomName) {
        return
      }
      if (requiredAmount !== "all" && sentAmount >= requiredAmount) {
        return
      }
      const resources = RoomResources.getOwnedRoomResource(fromRoomName)
      if (resources == null) {
        PrimitiveLogger.programError(`ResourceManager.sendTo() cannot retrieve owned room resources from ${roomLink(fromRoomName)}, ${coloredResourceType(resourceType)}`)
        return
      }
      const terminal = resources.activeStructures.terminal
      if (terminal == null) {
        return
      }
      const amount = terminal.store.getUsedCapacity(resourceType)
      const energyAmount = terminal.store.getUsedCapacity(RESOURCE_ENERGY)
      const sendAmount = ((): number => {
        if (requiredAmount === "all") {
          if (amount > energyAmount) {
            errorMessages.push(`Not enough energy in ${roomLink(fromRoomName)}`)
            return energyAmount
          }
          return amount
        }
        return Math.min(Math.min(amount, requiredAmount - sentAmount), energyAmount)
      })()
      const result = terminal.send(resourceType, sendAmount, roomName)
      switch (result) {
      case OK:
        sentAmount += sendAmount
        break

      case ERR_TIRED:
        errorMessages.push(`Terminal in ${roomLink(fromRoomName)} under cooldown`)
        break

      case ERR_NOT_ENOUGH_RESOURCES:
      case ERR_NOT_OWNER:
      case ERR_INVALID_ARGS:
        PrimitiveLogger.programError(`ResourceManager.sendTo() terminal.send() returns ${result}, ${roomLink(fromRoomName)} to ${roomLink(roomName)}, ${coloredResourceType(resourceType)}`)
        break
      }
    })

    const failedResult = (): ResultFailed<string> => {
      errorMessages.unshift(`${sentAmount}/${requiredAmount} ${coloredResourceType(resourceType)} sent to ${roomLink(roomName)}`)
      return Result.Failed(errorMessages.join("\n"))
    }

    if (requiredAmount === "all") {
      if (errorMessages.length <= 0) {
        return Result.Succeeded(sentAmount)
      }
      return failedResult()
    }
    if ((requiredAmount - sentAmount) <= 0) {
      return Result.Succeeded(sentAmount)
    }
    return failedResult()
  },
}

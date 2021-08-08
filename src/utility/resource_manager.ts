import { RoomResources } from "room_resource/room_resources"
import { RoomName } from "./room_name"

let list = null as Map<ResourceConstant, number> | null
let resourceInRoom = null as Map<RoomName, number> | null

interface ResourceManagerInterface {
  beforeTick(): void
  afterTick(): void

  list(): Map<ResourceConstant, number>
  resourceInRoom(resourceType: ResourceConstant): Map<RoomName, number>
}

export const ResourceManager: ResourceManagerInterface = {
  beforeTick(): void {
    list = null
    resourceInRoom = null
  },

  afterTick(): void {
  },

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
}

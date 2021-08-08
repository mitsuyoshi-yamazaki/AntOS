import { RoomResources } from "room_resource/room_resources"

let list = null as Map<ResourceConstant, number> | null

interface ResourceManagerInterface {
  beforeTick(): void
  afterTick(): void

  list(): Map<ResourceConstant, number>
}

export const ResourceManager: ResourceManagerInterface = {
  beforeTick(): void {
    list = null
  },

  afterTick(): void {
  },

  list(): Map<ResourceConstant, number> {
    if (list == null) {
      const result = new Map<ResourceConstant, number>()
      RoomResources.getOwnedRoomResources()
        .flatMap(resource => {
          const stores: StoreDefinition[] = []
          if (resource.activeStructures.terminal != null) {
            stores.push(resource.activeStructures.terminal.store)
          }
          if (resource.activeStructures.storage != null) {
            stores.push(resource.activeStructures.storage.store)
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
    return list
  },
}

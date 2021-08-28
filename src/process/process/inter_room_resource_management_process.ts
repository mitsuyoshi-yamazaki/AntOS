import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomResources } from "room_resource/room_resources"
import { RoomName } from "utility/room_name"
import { OwnedRoomInfo } from "room_resource/room_info"
import { ValuedArrayMap } from "utility/valued_collection"
import { processLog } from "process/process_log"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

export interface InterRoomResourceManagementProcessState extends ProcessState {
}

export class InterRoomResourceManagementProcess implements Process, Procedural {
  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) { }

  public encode(): InterRoomResourceManagementProcessState {
    return {
      t: "InterRoomResourceManagementProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: InterRoomResourceManagementProcessState): InterRoomResourceManagementProcess {
    return new InterRoomResourceManagementProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): InterRoomResourceManagementProcess {
    return new InterRoomResourceManagementProcess(Game.time, processId)
  }

  // public processShortDescription(): string {
  // }

  public runOnTick(): void {
    if ((Game.time % 31) !== 17) {
      return
    }

    const logs: string[] = [
    ]
    logs.push(...(new CompoundManager()).run())
    logs.push(...(new ResourceTransferer()).run())
    if (logs.length <= 0) {
      logs.push("No resource transfer")
    }
    logs.unshift("")
    logs.forEach(log => processLog(this, log))
  }
}

type OwnedRoomResource = {
  readonly isFull: boolean
  readonly terminal: StructureTerminal
  readonly storage: StructureStorage
  readonly roomInfo: OwnedRoomInfo

  /** 多い順 */
  readonly sortedResourceTypes: ResourceConstant[]
  isCoolingDown: boolean
  freeCapacity: {
    terminal: number
    storage: number
  },
}

const requiredEmptySpace = 30000
const transactionCostRound = 10000
const requiredCompounds = new Map<ResourceConstant, number>([
  [RESOURCE_CATALYZED_UTRIUM_ACID, 10000],
  [RESOURCE_CATALYZED_KEANIUM_ALKALIDE, 10000],
  [RESOURCE_CATALYZED_ZYNTHIUM_ACID, 10000],
  [RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, 10000],
  [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, 10000],
  [RESOURCE_CATALYZED_GHODIUM_ALKALIDE, 10000],
])

class CompoundManager {
  public run(): string[] {
    return []
  }
}

class ResourceTransferer {
  private readonly ownedRoomResources = new Map<RoomName, OwnedRoomResource>()
  private readonly resourceStores = new ValuedArrayMap<ResourceConstant, RoomName>()

  public constructor() {
    const addResourceStore = (store: StoreDefinition, roomName: RoomName) => {
      const resourceTypes = Object.keys(store) as ResourceConstant[]
      resourceTypes.forEach(resourceType => {
        const roomNames = this.resourceStores.getValueFor(resourceType)
        if (roomNames.includes(roomName) === true) {
          return
        }
        roomNames.push(roomName)
      })
    }

    RoomResources.getOwnedRoomResources().forEach(resources => {
      const terminal = resources.activeStructures.terminal
      const storage = resources.activeStructures.storage
      if (terminal == null) {
        return
      }
      if (storage == null) {
        return
      }

      const terminalFreeCapacity = terminal.store.getFreeCapacity()
      const storageFreeCapacity = storage.store.getFreeCapacity()
      const isFull = terminalFreeCapacity < requiredEmptySpace || storageFreeCapacity < 100000
      const storedResourceTypes: { resourceType: ResourceConstant, amount: number }[] = []
      const enumerateResources = (store: StoreDefinition): void => {
        const resourceTypes = Object.keys(store) as ResourceConstant[]
        resourceTypes.forEach(resourceType => {
          const requiredAmount = requiredCompounds.get(resourceType) ?? 0
          const amount = Math.max((store.getUsedCapacity(resourceType) ?? 0) - requiredAmount, 0)
          storedResourceTypes.push({
            resourceType,
            amount,
          })
        })
      }
      enumerateResources(terminal.store)
      enumerateResources(storage.store)
      storedResourceTypes.sort((lhs, rhs) => {
        return rhs.amount - lhs.amount
      })

      this.ownedRoomResources.set(resources.room.name, {
        isFull,
        terminal,
        storage,
        roomInfo: resources.roomInfo,
        isCoolingDown: terminal.cooldown > 0,
        sortedResourceTypes: storedResourceTypes.map(type => type.resourceType),
        freeCapacity: {
          terminal: terminalFreeCapacity,
          storage: storageFreeCapacity,
        }
      })

      if (isFull !== true) {
        addResourceStore(terminal.store, resources.room.name)
        addResourceStore(storage.store, resources.room.name)
      }
    })
  }

  public run(): string[] {
    const logs: string[] = []
    if (this.ownedRoomResources.size <= 1) {
      return logs
    }

    this.ownedRoomResources.forEach((resources, roomName) => {
      if (resources.isFull !== true) {
        return
      }
      if (resources.isCoolingDown === true) {
        return
      }

      const energyAmount = resources.terminal.store.getUsedCapacity(RESOURCE_ENERGY)
      if (energyAmount > 100000 && resources.roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] == null) {
        const target = this.resourceInsufficientTarget(roomName, RESOURCE_ENERGY)
        if (target != null) {
          const sendAmount = Math.min(Math.ceil((energyAmount - 50000) / 2), target.maxAmount)
          const log = this.send(resources, RESOURCE_ENERGY, sendAmount, target.resources)
          if (log != null) {
            logs.push(log)
          }
          return
        }
      }

      // Resourceをまとめないので循環してしまう
      // const excessResource = ((): { resourceType: ResourceConstant, sendAmount: number } | null => {
      //   for (const resourceType of resources.sortedResourceTypes) {
      //     if (resourceType === RESOURCE_ENERGY) {
      //       continue
      //     }
      //     const requiredAmount = requiredCompounds.get(resourceType) ?? 0
      //     const sendAmount = Math.max(resources.terminal.store.getUsedCapacity(resourceType) - requiredAmount, 0)
      //     if (sendAmount <= 0) {
      //       continue
      //     }
      //     return {
      //       resourceType,
      //       sendAmount,
      //     }
      //   }
      //   return null
      // })()

      // if (excessResource != null) {
      //   const target = this.resourceInsufficientTarget(roomName, excessResource.resourceType) ?? this.freeSpaceRoom(roomName, excessResource.resourceType)
      //   if (target != null) {
      //     const energyAmount = resources.terminal.store.getUsedCapacity(RESOURCE_ENERGY)
      //     const sendAmount = Math.min(excessResource.sendAmount, target.maxAmount, energyAmount)
      //     if (sendAmount > 0) {
      //       const log = this.send(resources, excessResource.resourceType, sendAmount, target.resources)
      //       if (log != null) {
      //         logs.push(log)
      //       }
      //       return
      //     }
      //   }
      // }
    })

    return logs
  }

  private send(resources: OwnedRoomResource, resourceType: ResourceConstant, amount: number, destinationResource: OwnedRoomResource): string | null {
    const destination = destinationResource.terminal.room.name
    const result = resources.terminal.send(resourceType, amount, destination)
    switch (result) {
    case OK: {
      resources.isCoolingDown = true
      destinationResource.freeCapacity.terminal -= amount
      const roomInfo = RoomResources.getRoomInfo(destinationResource.terminal.room.name)
      if (roomInfo != null && roomInfo.roomType === "owned") {
        const resourceInsufficiency = roomInfo.resourceInsufficiencies[resourceType]
        if (resourceInsufficiency != null && (typeof resourceInsufficiency === "number")) {
          const updatedValue = resourceInsufficiency - amount
          if (updatedValue < 0) {
            delete roomInfo.resourceInsufficiencies[resourceType]
          } else {
            roomInfo.resourceInsufficiencies[resourceType] = updatedValue
          }
        }
      }
      return `Sent ${coloredText(`${amount}`, "info")} ${coloredResourceType(resourceType)} from ${roomLink(resources.terminal.room.name)} to ${roomLink(destination)}`
    }

    case ERR_NOT_OWNER:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_INVALID_ARGS:
    case ERR_TIRED:
    default:
      PrimitiveLogger.programError(`ResourceManager send returns ${result}, ${amount} ${coloredResourceType} from ${roomLink(resources.terminal.room.name)} to ${roomLink(destination)}`)
      return null
    }
  }

  private resourceInsufficientTarget(fromRoomName: RoomName, resourceType: ResourceConstant): { resources: OwnedRoomResource, maxAmount: number } | null {
    const energyInsufficientRooms: { resources: OwnedRoomResource, maxAmount: number, priority: number }[] = RoomResources.getResourceInsufficientRooms(resourceType)
      .flatMap(roomInfo => {
        if (roomInfo.roomName === fromRoomName) {
          return []
        }
        const targetRoomResource = this.ownedRoomResources.get(roomInfo.roomName)
        if (targetRoomResource == null) {
          return []
        }
        if (targetRoomResource.terminal.store.getFreeCapacity(resourceType) < requiredEmptySpace) {
          return []
        }
        if (resourceType === RESOURCE_ENERGY) {
          const targetRoomEnergyAmount = targetRoomResource.terminal.store.getUsedCapacity(resourceType) + targetRoomResource.storage.store.getUsedCapacity(resourceType)
          if (targetRoomEnergyAmount > 500000) {
            return []
          }
        }

        const maxAmount = ((): number => {
          const freeCapacity = Math.max(targetRoomResource.freeCapacity.terminal - requiredEmptySpace, 0)
          if (typeof roomInfo.priority === "number") {
            return Math.min(roomInfo.priority, freeCapacity)
          }
          return freeCapacity
        })()

        const priority = Game.market.calcTransactionCost(10000, fromRoomName, roomInfo.roomName)
        return {
          resources: targetRoomResource,
          maxAmount,
          priority,
        }
      })

    return energyInsufficientRooms
      .sort((lhs, rhs) => {
        if (Math.floor(lhs.priority / transactionCostRound) !== Math.floor(rhs.priority / transactionCostRound)) {
          return lhs.priority < rhs.priority ? -1 : 1
        }
        return lhs.maxAmount > rhs.maxAmount ? -1 : 1
      })[0] ?? null
  }

  private freeSpaceRoom(fromRoomName: RoomName, resourceType: ResourceConstant): { resources: OwnedRoomResource, maxAmount: number } | null {
    const freeSpaceRooms: { resources: OwnedRoomResource, maxAmount: number, priority: number }[] = []
    this.ownedRoomResources
      .forEach((targetRoomResource, roomName) => {
        if (roomName === fromRoomName) {
          return
        }
        if (targetRoomResource.terminal.store.getFreeCapacity(resourceType) < requiredEmptySpace) {
          return
        }
        if (resourceType === RESOURCE_ENERGY) {
          return
        }
        const maxAmount = Math.max(targetRoomResource.terminal.store.getFreeCapacity() - requiredEmptySpace, 0)
        if (maxAmount <= 0) {
          return
        }
        const priority = Game.market.calcTransactionCost(10000, fromRoomName, roomName)

        freeSpaceRooms.push({
          resources: targetRoomResource,
          maxAmount,
          priority,
        })
      })

    return freeSpaceRooms
      .sort((lhs, rhs) => {
        if (Math.floor(lhs.priority / transactionCostRound) !== Math.floor(rhs.priority / transactionCostRound)) {
          return lhs.priority < rhs.priority ? -1 : 1
        }
        return lhs.maxAmount > rhs.maxAmount ? -1 : 1
      })[0] ?? null
  }
}

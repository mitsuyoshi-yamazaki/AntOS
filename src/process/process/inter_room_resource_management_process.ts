import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomResources } from "room_resource/room_resources"
import { RoomName } from "utility/room_name"
import { OwnedRoomInfo } from "room_resource/room_info"
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
    logs.forEach(log => processLog(this, log))
  }
}

type StorageSpace = "full" | "empty space"
type OwnedRoomResource = {
  readonly storageSpace: StorageSpace
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

const terminalRequiredEmptySpace = 30000
const transactionCostRound = 10000
const requiredCompounds = new Map<ResourceConstant, number>([
  [RESOURCE_CATALYZED_UTRIUM_ACID, 10000],
  [RESOURCE_CATALYZED_KEANIUM_ALKALIDE, 10000],
  [RESOURCE_CATALYZED_ZYNTHIUM_ACID, 10000],
  [RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE, 10000],
  [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE, 10000],
  [RESOURCE_CATALYZED_GHODIUM_ALKALIDE, 10000],
])
const excludedResourceTypes: ResourceConstant[] = [
  RESOURCE_ENERGY,
  RESOURCE_POWER,
  RESOURCE_OPS,
]

class CompoundManager {
  public run(): string[] {
    return []
  }
}

class ResourceTransferer {
  private readonly ownedRoomResources = new Map<RoomName, OwnedRoomResource>()

  public constructor() {
    RoomResources.getOwnedRoomResources().forEach(resources => {
      const terminal = resources.activeStructures.terminal
      const storage = resources.activeStructures.storage
      if (terminal == null) {
        return
      }
      if (storage == null) {
        return
      }

      const margin = 1000
      const terminalFreeCapacity = Math.max(terminal.store.getFreeCapacity() - terminalRequiredEmptySpace - margin, 0)
      const storageFreeCapacity = storage.store.getFreeCapacity()
      const storageSpace = ((): StorageSpace => {
        if (terminalFreeCapacity <= 0 || storageFreeCapacity < 100000) {
          return "full"
        }
        if ((storageFreeCapacity + storage.store.getUsedCapacity(RESOURCE_ENERGY)) < 300000) {
          return "full"
        }
        return "empty space"
      })()
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
        storageSpace,
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
    })
  }

  public run(): string[] {
    const logs: string[] = []
    const disableEnergyTransfer = Memory.gameInfo.disableEnergyTransfer === true
    const disableResourceTransfer = Memory.gameInfo.disableResourceTransfer === true
    if (disableEnergyTransfer === true && disableResourceTransfer === true) {
      logs.push("Disabled all resource transfer")
    } else if (disableEnergyTransfer === true) {
      logs.push("Disabled energy transfer")
    } else if (disableResourceTransfer === true) {
      logs.push("Disabled resource transfer")
    }
    if (this.ownedRoomResources.size <= 1) {
      return logs
    }

    this.ownedRoomResources.forEach((resources, roomName) => {
      if (resources.storageSpace === "empty space") {
        return
      }
      if (resources.isCoolingDown === true) {
        return
      }

      const terminalEnergyAmount = resources.terminal.store.getUsedCapacity(RESOURCE_ENERGY)
      const storageEnergyAmount = resources.storage.store.getUsedCapacity(RESOURCE_ENERGY)
      if (terminalEnergyAmount < 50000 || storageEnergyAmount < 50000) {
        return
      }

      if (disableEnergyTransfer !== true && terminalEnergyAmount > 100000 && resources.roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] == null) {
        const target = this.resourceInsufficientTarget(roomName, RESOURCE_ENERGY)
        if (target != null) {
          const sendAmount = Math.min(Math.ceil((terminalEnergyAmount - 50000) / 2), target.maxAmount)
          const log = this.send(resources, RESOURCE_ENERGY, sendAmount, target.resources)
          if (log != null) {
            logs.push(log)
          }
          return
        }
      }

      if (disableResourceTransfer !== true) {
        const excessResource = ((): { resourceType: ResourceConstant, sendAmount: number } | null => {
          for (const resourceType of resources.sortedResourceTypes) {
            if (excludedResourceTypes.includes(resourceType) === true) {
              continue
            }
            const requiredAmount = requiredCompounds.get(resourceType) ?? 0
            const sendAmount = Math.max(resources.terminal.store.getUsedCapacity(resourceType) - requiredAmount, 0)
            if (sendAmount <= 0) {
              continue
            }
            return {
              resourceType,
              sendAmount,
            }
          }
          return null
        })()

        if (excessResource != null) {
          const target = this.resourceInsufficientTarget(roomName, excessResource.resourceType) ?? this.freeSpaceRoom(roomName, excessResource.resourceType)
          if (target != null) {
            const energyAmount = resources.terminal.store.getUsedCapacity(RESOURCE_ENERGY)
            const sendAmount = Math.min(excessResource.sendAmount, target.maxAmount, energyAmount)
            if (sendAmount > 0) {
              const log = this.send(resources, excessResource.resourceType, sendAmount, target.resources)
              if (log != null) {
                logs.push(log)
              }
              return
            }
          }
        }
      }
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
        if (targetRoomResource.storageSpace !== "empty space") {
          return []
        }
        if (targetRoomResource.freeCapacity.terminal <= 0 || targetRoomResource.freeCapacity.storage <= 0) {
          return []
        }
        if (resourceType === RESOURCE_ENERGY) {
          const targetRoomEnergyAmount = targetRoomResource.terminal.store.getUsedCapacity(resourceType) + targetRoomResource.storage.store.getUsedCapacity(resourceType)
          if (targetRoomEnergyAmount > 500000) {
            return []
          }
        }

        const maxAmount = ((): number => {
          const freeCapacity = targetRoomResource.freeCapacity.terminal
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
    const resourceRooms: { resources: OwnedRoomResource, maxAmount: number, priority: number }[] = []
    const freeSpaceRooms: { resources: OwnedRoomResource, maxAmount: number, priority: number }[] = []
    this.ownedRoomResources
      .forEach((targetRoomResource, roomName) => {
        if (roomName === fromRoomName) {
          return
        }
        if (targetRoomResource.storageSpace !== "empty space") {
          return
        }
        if (targetRoomResource.freeCapacity.terminal <= 0 || targetRoomResource.freeCapacity.storage <= 0) {
          return
        }
        if (resourceType === RESOURCE_ENERGY) {
          return
        }
        const maxAmount = targetRoomResource.freeCapacity.terminal
        const priority = Game.market.calcTransactionCost(10000, fromRoomName, roomName)
        const resourceAmount = targetRoomResource.terminal.store.getUsedCapacity(resourceType) + targetRoomResource.storage.store.getUsedCapacity(resourceType)

        if (resourceAmount > 0) {
          resourceRooms.push({
            resources: targetRoomResource,
            maxAmount,
            priority: priority - resourceAmount,
          })
        }

        freeSpaceRooms.push({
          resources: targetRoomResource,
          maxAmount,
          priority,
        })
      })

    const targetRoomResource = resourceRooms.sort()
      .sort((lhs, rhs) => {
        if (Math.floor(lhs.priority / transactionCostRound) !== Math.floor(rhs.priority / transactionCostRound)) {
          return lhs.priority < rhs.priority ? -1 : 1
        }
        return lhs.maxAmount > rhs.maxAmount ? -1 : 1
      })[0]
    if (targetRoomResource != null) {
      return targetRoomResource
    }

    return freeSpaceRooms
      .sort((lhs, rhs) => {
        if (Math.floor(lhs.priority / transactionCostRound) !== Math.floor(rhs.priority / transactionCostRound)) {
          return lhs.priority < rhs.priority ? -1 : 1
        }
        return lhs.maxAmount > rhs.maxAmount ? -1 : 1
      })[0] ?? null
  }
}

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomResources } from "room_resource/room_resources"
import type { RoomName } from "shared/utility/room_name_types"
import { OwnedRoomInfo } from "room_resource/room_info"
import { processLog } from "os/infrastructure/logger"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProcessDecoder } from "process/process_decoder"
import { OperatingSystem } from "os/os"
import { Season2055924SendResourcesProcess } from "process/temporary/season_2055924_send_resources_process"
import { SellResourcesProcess } from "process/onetime/sell_resources_process"
import { CommodityConstant, DepositConstant } from "shared/utility/resource"
import { Market } from "shared/utility/market"

ProcessDecoder.register("InterRoomResourceManagementProcess", state => {
  return InterRoomResourceManagementProcess.decode(state as InterRoomResourceManagementProcessState)
})

const resourcesToSell: ResourceConstant[] = [
  ...DepositConstant,
  ...CommodityConstant,
]

export interface InterRoomResourceManagementProcessState extends ProcessState {
}

// FixMe: typo inter/intra
export class InterRoomResourceManagementProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.taskIdentifier = this.constructor.name
  }

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

    const resourceTransfer = new ResourceTransferer()
    logs.push(...resourceTransfer.run())

    if (resourceTransfer.resourceIncomeDisabledRoomNames.length > 0) {
      processLog(this, `${coloredText("[RESOURCE]", "almost")} resourceIncomeDisabledRoomNames: ${resourceTransfer.resourceIncomeDisabledRoomNames.map(r => roomLink(r)).join(",")}`)
    }

    // if (logs.length <= 0) {
    //   logs.push("No resource transfer")
    // }
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
  public get resourceIncomeDisabledRoomNames(): RoomName[] {
    return this._resourceIncomeDisabledRoomNames
  }

  private readonly ownedRoomResources = new Map<RoomName, OwnedRoomResource>()
  private readonly disabledRoomNames: RoomName[] = []
  private readonly _resourceIncomeDisabledRoomNames: RoomName[] = []

  public constructor() {
    OperatingSystem.os.listAllProcesses().forEach(processInfo => {
      if (processInfo.process instanceof Season2055924SendResourcesProcess) {
        const roomName = processInfo.process.parentRoomName
        if (this.disabledRoomNames.includes(roomName) !== true) {
          this.disabledRoomNames.push(roomName)
        }
        return
      }
      if (processInfo.process instanceof SellResourcesProcess) {
        const roomName = processInfo.process.ownedRoomName
        if (this.disabledRoomNames.includes(roomName) !== true) {
          this.disabledRoomNames.push(roomName)
        }
        return
      }
    })

    RoomResources.getOwnedRoomResources().forEach(resources => {
      if (this.disabledRoomNames.includes(resources.room.name) === true) {
        return
      }

      const terminal = resources.activeStructures.terminal
      const storage = resources.activeStructures.storage
      if (terminal == null) {
        return
      }
      if (storage == null) {
        return
      }

      const energyCapacity = terminal.store.getUsedCapacity(RESOURCE_ENERGY) + terminal.store.getFreeCapacity(RESOURCE_ENERGY)
      if (energyCapacity < 100000) {
        this.resourceIncomeDisabledRoomNames.push(resources.room.name)
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
      const excludedResourceTypes = resources.roomInfoAccessor.usingAllResourceTypes().filter(resourceType => {
        if (resources.getResourceAmount(resourceType) <= 120000) {
          return true
        }
        return false
      })

      const enumerateResources = (store: StoreDefinition): void => {
        const resourceTypes = Object.keys(store) as ResourceConstant[]
        resourceTypes.forEach(resourceType => {
          if (excludedResourceTypes.includes(resourceType) === true) {
            return
          }
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
      if (terminalEnergyAmount < 50000 || (terminalEnergyAmount + storageEnergyAmount) < 200000) {
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
          if (resourcesToSell.includes(excessResource.resourceType) === true) {
            const result = Market.sell(excessResource.resourceType, roomName, excessResource.sendAmount)
            switch (result.resultType) {
            case "succeeded":
              logs.push(result.value)
              return
            case "failed":
              logs.push(result.reason)
              return
            }
          }

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
    const resourceInsufficientRooms: { resources: OwnedRoomResource, maxAmount: number, priority: number }[] = RoomResources.getResourceInsufficientRooms(resourceType)
      .flatMap(roomInfo => {
        if (this.resourceIncomeDisabledRoomNames.includes(roomInfo.roomName) === true) {
          return []
        }
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

    return resourceInsufficientRooms
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
        if (this.resourceIncomeDisabledRoomNames.includes(roomName) === true) {
          return
        }
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

        if (resourceAmount > 0 && resourceAmount <= 120000) {
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

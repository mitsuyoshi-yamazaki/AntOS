import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { RoomResources } from "room_resource/room_resources"
import { GameConstants } from "utility/constants"
import { Timestamp } from "utility/timestamp"
import { RoomName } from "utility/room_name"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { OperatingSystem } from "os/os"
import { PowerProcessProcess } from "process/process/power_creep/power_process_process"
import { processLog } from "os/infrastructure/logger"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { ContinuouslyProduceCommodityProcess } from "process/process/continuously_produce_commodity_process"
import { Season4332399SKMineralHarvestProcess } from "./season4_332399_sk_mineral_harvest_process"
import { CommodityIngredient, commodityTier, isCommodityConstant } from "utility/resource"
import { ValuedArrayMap } from "utility/valued_collection"

ProcessDecoder.register("Season41076620ResourceManagerProcess", state => {
  return Season41076620ResourceManagerProcess.decode(state as Season41076620ResourceManagerProcessState)
})

type ResourceTransfer = {
  readonly resourceType: ResourceConstant
  readonly amount: number
  readonly destinationRoomName: RoomName
}
type ResourceAmount = {
  readonly resourceType: ResourceConstant
  readonly amount: number
}

const terminalMinimumFreeSpace = 10000
const harvestingMineralMinimumAmount = 20000
const runInterval = 1000
const terminalCooldownInterval = Math.ceil(GameConstants.structure.terminal.cooldown * 1.5)

export interface Season41076620ResourceManagerProcessState extends ProcessState {
  readonly processState: {
    readonly dryRun: boolean
    readonly runNextTick: boolean
    readonly lastRunTimestamp: Timestamp  // (Game.time % runInterval) === lastRunTimestamp
  }
  readonly resourceTransfer: { [roomName: string]: ResourceTransfer[] }
  readonly minimumResourceAmounts: { [roomName: string]: ResourceAmount[] }
}

/**
 * - 最適計算はむずいので余ったResourceで作れる限りHigher Tier Commodityを生産する
 * - Factory Levelに応じたCommodity生産
 * - for Research
 * - for Boost
 * - attacked
 * - room_infoに情報をもたせたうえでroom_infoにproductを設定する
 * - 余った（スコア可能な）tier0 commodityも算出できる
 * - どこにmineralを使うとスコアを最大化できるか
 * - 1000tickごとに次の1000tickで何を作るか基準単位（10000resource）を設けて設定する
 */
export class Season41076620ResourceManagerProcess implements Process, Procedural, MessageObserver {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly processState: {
      dryRun: boolean
      runNextTick: boolean
      lastRunTimestamp: Timestamp
    },
    private resourceTransfer: { [roomName: string]: ResourceTransfer[] },
    private minimumResourceAmounts: { [roomName: string]: ResourceAmount[] },
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): Season41076620ResourceManagerProcessState {
    return {
      t: "Season41076620ResourceManagerProcess",
      l: this.launchTime,
      i: this.processId,
      processState: this.processState,
      resourceTransfer: this.resourceTransfer,
      minimumResourceAmounts: this.minimumResourceAmounts,
    }
  }

  public static decode(state: Season41076620ResourceManagerProcessState): Season41076620ResourceManagerProcess {
    return new Season41076620ResourceManagerProcess(state.l, state.i, state.processState, state.resourceTransfer, state.minimumResourceAmounts ?? {})
  }

  public static create(processId: ProcessId): Season41076620ResourceManagerProcess {
    const processState = {
      dryRun: true,
      runNextTick: false,
      lastRunTimestamp: Game.time
    }
    return new Season41076620ResourceManagerProcess(Game.time, processId, processState, {}, {})
  }

  public processShortDescription(): string {
    const transferingResourceTypes: ResourceConstant[] = []
    Array.from(Object.entries(this.resourceTransfer)).forEach(([, resourceTransferList]) => {
      resourceTransferList.forEach(resourceTransfer => {
        if (transferingResourceTypes.includes(resourceTransfer.resourceType) === true) {
          return
        }
        transferingResourceTypes.push(resourceTransfer.resourceType)
      })
    })

    const lastRun = ((Game.time % runInterval) - this.processState.lastRunTimestamp + runInterval) % runInterval
    return `last run: ${lastRun} ticks ago, transfering ${transferingResourceTypes.map(resourceType => coloredResourceType(resourceType)).join(",")}`
  }

  public processDescription(): string {
    const roomDescriptions = RoomResources.getOwnedRoomResources().flatMap((roomResource): string[] => {
      const roomName = roomResource.room.name
      const minimumAmounts = this.minimumResourceAmounts[roomName]
      const minimumAmountDescription = ((): string => {
        if (minimumAmounts == null || minimumAmounts.length <= 0) {
          return ""
        }
        return `, minimum amounts: ${minimumAmounts.map(amount => `${coloredResourceType(amount.resourceType)} ${amount.amount}`).join(", ")}`
      })()

      const roomDescription: string[] = [
        `- ${roomLink(roomName)}${minimumAmountDescription}`,
      ]

      const resourceTransferList = this.resourceTransfer[roomName]
      if (minimumAmountDescription.length <= 0 && (resourceTransferList == null || resourceTransferList.length <= 0)) {
        return []
      }

      if (resourceTransferList != null && resourceTransferList.length > 0) {
        roomDescription.push(...resourceTransferList.map(resourceTransfer => `  - ${roomLink(resourceTransfer.destinationRoomName)}: ${resourceTransfer.amount} ${coloredResourceType(resourceTransfer.resourceType)}`))
      }

      return roomDescription
    })

    const lastRun = ((Game.time % runInterval) - this.processState.lastRunTimestamp + runInterval) % runInterval
    const descriptions: string[] = [
      `last run: ${lastRun} ticks ago`,
      ...roomDescriptions,
    ]

    return descriptions.join("\n")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "add_boosts", "remove_boosts", "status", "run_next_tick", "set_dry_run", "refresh_minimum_resource_amounts", "clear_reserved_transfers"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      // case "add_boosts":
      //   return this.addBoosts(components)
      case "status":
        return this.processDescription()
      case "run_next_tick":
        this.processState.runNextTick = true
        return "run_next_tick set"
      case "set_dry_run": {
        const listArguments = new ListArguments(components)
        const dryRun = listArguments.boolean(0, "dry run").parse()
        const oldValue = this.processState.dryRun
        this.processState.dryRun = dryRun

        return `dry run set ${dryRun} (from ${oldValue})`
      }
      case "refresh_minimum_resource_amounts":
        return this.refreshMinimumResourceAmounts()
      case "clear_reserved_transfers":
        this.resourceTransfer = {}
        return "ok"
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  /** @throws */
  private refreshMinimumResourceAmounts(): string {
    const harvestingMineralTypes: MineralConstant[] = []
    this.minimumResourceAmounts = {}

    const getMinimumResourceAmountList = (roomName: RoomName): ResourceAmount[] => {
      const stored = this.minimumResourceAmounts[roomName]
      if (stored != null) {
        return stored
      }
      const newList: ResourceAmount[] = []
      this.minimumResourceAmounts[roomName] = newList
      return newList
    }

    RoomResources.getOwnedRoomResources().forEach(roomResource => {
      if (roomResource.mineral == null) {
        return
      }
      const mineralType = roomResource.mineral.mineralType
      if (harvestingMineralTypes.includes(mineralType) === true) {
        return
      }
      harvestingMineralTypes.push(mineralType)

      getMinimumResourceAmountList(roomResource.room.name).push({
        resourceType: mineralType,
        amount: harvestingMineralMinimumAmount,
      })
    })

    const skMineralHarvestProcesses: Season4332399SKMineralHarvestProcess[] = []
    const produceCommodityProcesses: ContinuouslyProduceCommodityProcess[] = []

    OperatingSystem.os.listAllProcesses().forEach(processInfo => {
      const process = processInfo.process
      if (process instanceof Season4332399SKMineralHarvestProcess) {
        skMineralHarvestProcesses.push(process)
        return
      }
      if (process instanceof ContinuouslyProduceCommodityProcess) {
        produceCommodityProcesses.push(process)
        return
      }
    })

    skMineralHarvestProcesses.forEach(process => {
      const mineralType = process.harvestingMineralType()
      if (mineralType == null) {
        return
      }
      if (harvestingMineralTypes.includes(mineralType) === true) {
        return
      }
      harvestingMineralTypes.push(mineralType)

      getMinimumResourceAmountList(process.roomName).push({
        resourceType: mineralType,
        amount: harvestingMineralMinimumAmount,
      })
    })

    produceCommodityProcesses.forEach(process => {
      const minimumAmountList = getMinimumResourceAmountList(process.roomName)
      minimumAmountList.forEach(amount => {
        process.setResourceMinimumAmount(amount.resourceType, amount.amount)
      })
    })

    const results = Array.from(Object.entries(this.minimumResourceAmounts)).map(([roomName, amountList]) => {
      return `- ${roomLink(roomName)}: ${amountList.map(amount => `${coloredResourceType(amount.resourceType)} ${amount.amount}`).join(", ")}`
    })
    return `minimum amount set:\n${results.join("\n")}`
  }

  public runOnTick(): void {
    if ((Game.time % terminalCooldownInterval) === 0) {
      this.transferResources()
    }
    if ((this.processState.runNextTick !== true) && ((Game.time % runInterval) !== (this.processState.lastRunTimestamp % runInterval))) {
      return
    }
    this.processState.runNextTick = false
    this.processState.lastRunTimestamp = (Game.time % runInterval)

    this.calculateResourceTransfer()
  }

  private calculateResourceTransfer(): void {
    this.resourceTransfer = {}

    const allRoomResources = RoomResources.getOwnedRoomResources()
    const terminals: StructureTerminal[] = []
    const factories: StructureFactory[] = []

    allRoomResources.forEach(roomResource => {
      if (roomResource.activeStructures.terminal != null) {
        terminals.push(roomResource.activeStructures.terminal)
      }
      if (roomResource.activeStructures.factory != null) {
        factories.push(roomResource.activeStructures.factory)
      }
    })

    const powerProcessingRoomNames: RoomName[] = []
    const produceProcesses: ContinuouslyProduceCommodityProcess[] = []
    OperatingSystem.os.listAllProcesses().forEach(processInfo => {
      const process = processInfo.process
      if (process instanceof PowerProcessProcess) {
        powerProcessingRoomNames.push(process.parentRoomName)
        return
      }
      if (process instanceof ContinuouslyProduceCommodityProcess) {
        produceProcesses.push(process)
        return
      }
    })

    this.calculatePowerTransfer(allRoomResources, powerProcessingRoomNames)
    this.calculateCommodityIngredientTransfer(allRoomResources, produceProcesses)
  }

  private calculateCommodityIngredientTransfer(roomResources: OwnedRoomResource[], produceProcesses: ContinuouslyProduceCommodityProcess[]): void {
    const excludedIngredientTypes: CommodityIngredient[] = [RESOURCE_ENERGY]
    const allRequiredIngredients: CommodityIngredient[] = []
    const requiredIngredientMap = new ValuedArrayMap<CommodityIngredient, RoomName>()

    produceProcesses.forEach(process => {
      const roomName = process.roomName
      const ingredients = process.requiredIngredients().filter(ingredient => {
        if (excludedIngredientTypes.includes(ingredient) === true) {
          return false
        }
        return true
      })

      ingredients.forEach(ingredient => {
        requiredIngredientMap.getValueFor(ingredient).push(roomName)

        if (allRequiredIngredients.includes(ingredient) !== true) {
          allRequiredIngredients.push(ingredient)
        }
      })
    })

    const getIngredientMinimumAmount = (ingredient: CommodityIngredient): number => {
      if (!(isCommodityConstant(ingredient))) {
        return 5000
      }
      switch (commodityTier(ingredient)) {
      case 0:
        return 200
      case 1:
        return 10
      case 2:
      case 3:
      case 4:
      case 5:
        return 1
      }
    }
    const resourceRoomMap = new ValuedArrayMap<CommodityIngredient, OwnedRoomResource>()

    const getMinimumAmountFor = (ingredient: CommodityIngredient, roomName: RoomName): number | null => {
      const roomResourceMinimumAmounts = this.minimumResourceAmounts[roomName]
      if (roomResourceMinimumAmounts == null) {
        return null
      }
      const amount = roomResourceMinimumAmounts.find(minimumAmount => minimumAmount.resourceType === ingredient)
      if (amount == null) {
        return null
      }
      return amount.amount
    }

    roomResources.forEach(roomResource => {
      const roomName = roomResource.room.name
      const terminal = roomResource.activeStructures.terminal
      if (terminal == null) {
        return
      }

      allRequiredIngredients.forEach(ingredient => {
        const minimumAmount = getMinimumAmountFor(ingredient, roomName) ?? 0
        if (roomResource.getResourceAmount(ingredient) < (minimumAmount + getIngredientMinimumAmount(ingredient))) {
          return
        }
        resourceRoomMap.getValueFor(ingredient).push(roomResource)
      })
    })

    const getSendableResourceAmount = (ingredient: CommodityIngredient, roomResource: OwnedRoomResource): number => {
      const minimumAmount = getMinimumAmountFor(ingredient, roomResource.room.name) ?? 0
      const resourceAmount = roomResource.getResourceAmount(ingredient)
      const amount = resourceAmount - minimumAmount
      if (amount <= 0 ) {
        return 0
      }
      return amount
    }

    const transferMaxAmount = 10000
    const registerResourceTransfer = (ingredient: CommodityIngredient, fromRoomResources: OwnedRoomResource[], toRoomNames: RoomName[]): void => {
      const roomResources = fromRoomResources.filter(roomResource => {
        const roomName = roomResource.room.name
        if (requiredIngredientMap.getValueFor(ingredient).includes(roomName) === true) {
          return false
        }
        return true
      })
      if (roomResources.length <= 0) {
        return
      }

      roomResources.forEach(roomResource => {
        const roomName = roomResource.room.name
        const filteredDestinationRoomNames = toRoomNames.filter(toRoomName => {
          if (toRoomName === roomName) {
            return false
          }
          return true
        })
        if (filteredDestinationRoomNames.length <= 0) {
          return
        }

        const totalAmountToSend = getSendableResourceAmount(ingredient, roomResource)
        const sendAmountForRoom = Math.min(Math.floor(totalAmountToSend / filteredDestinationRoomNames.length), transferMaxAmount)
        if (sendAmountForRoom <= 0) {
          return
        }

        filteredDestinationRoomNames.forEach(toRoomName => {
          this.getResourceTransferListFor(roomName).push({
            resourceType: ingredient,
            amount: sendAmountForRoom,
            destinationRoomName: toRoomName,
          })
        })
      })
    }

    Array.from(resourceRoomMap.entries()).forEach(([ingredient, roomResources]) => {
      const destinationRooms = requiredIngredientMap.getValueFor(ingredient)
      registerResourceTransfer(ingredient, roomResources, destinationRooms)
    })

    Array.from(Object.keys(this.resourceTransfer)).forEach(roomName => {
      this.getResourceTransferListFor(roomName).sort((lhs, rhs) => {
        return lhs.amount - rhs.amount
      })
    })
  }

  private calculatePowerTransfer(roomResources: OwnedRoomResource[], powerProcessingRoomNames: RoomName[]): void {
    const destinations = powerProcessingRoomNames.flatMap((roomName): { roomName: RoomName, powerAmount: number }[] => {
      const roomResource = RoomResources.getOwnedRoomResource(roomName)
      if (roomResource == null || roomResource.activeStructures.terminal == null) {
        return []
      }
      const terminal = roomResource.activeStructures.terminal

      return [{
        roomName,
        powerAmount: terminal.store.getUsedCapacity(RESOURCE_POWER),
      }]
    })
    if (destinations.length <= 0) {
      return
    }

    destinations.sort((lhs, rhs) => {
      return lhs.powerAmount - rhs.powerAmount
    })

    roomResources.forEach(roomResource => {
      if (powerProcessingRoomNames.includes(roomResource.room.name) === true) {
        return
      }
      if (roomResource.activeStructures.terminal == null) {
        return
      }
      const terminal = roomResource.activeStructures.terminal
      const powerAmount = terminal.store.getUsedCapacity(RESOURCE_POWER)

      if (powerAmount <= 0) {
        return
      }

      const destination = destinations.shift()
      if (destination == null) {
        return
      }

      this.getResourceTransferListFor(roomResource.room.name).push({
        resourceType: RESOURCE_POWER,
        amount: powerAmount,
        destinationRoomName: destination.roomName,
      })
    })
  }

  private getResourceTransferListFor(roomName: RoomName): ResourceTransfer[] {
    const stored = this.resourceTransfer[roomName]
    if (stored != null) {
      return stored
    }

    const newList: ResourceTransfer[] = []
    this.resourceTransfer[roomName] = newList
    return newList
  }

  private transferResources(): void {
    const receivedRoomNames: RoomName[] = []
    const sentResources: {
      readonly resourceType: ResourceConstant,
      readonly amount: number,
      readonly destinationRoomName: RoomName,
      readonly fromRoomName: RoomName,
    }[] = []

    Array.from(Object.entries(this.resourceTransfer)).forEach(([roomName, resourceTransfer]) => {
      const roomResource = RoomResources.getOwnedRoomResource(roomName)
      if (roomResource == null) {
        resourceTransfer.splice(0, resourceTransfer.length)
        return
      }
      const terminal = roomResource.activeStructures.terminal
      if (terminal == null || terminal.cooldown > 0) {
        return
      }
      if (roomResource.getResourceAmount(RESOURCE_ENERGY) < 50000) {
        resourceTransfer.splice(0, resourceTransfer.length)
        return
      }
      const transfer = resourceTransfer[0]
      if (transfer == null) {
        return
      }

      if (receivedRoomNames.includes(transfer.destinationRoomName) === true) {
        return
      }
      receivedRoomNames.push(transfer.destinationRoomName)

      const destinationRoomResource = RoomResources.getOwnedRoomResource(transfer.destinationRoomName)
      if (destinationRoomResource == null || destinationRoomResource.activeStructures.terminal == null || destinationRoomResource.activeStructures.terminal.store.getFreeCapacity() < terminalMinimumFreeSpace) {
        return
      }

      sentResources.push({
        ...transfer,
        fromRoomName: terminal.room.name,
      })

      if (this.processState.dryRun === true) {
        resourceTransfer.shift()
        return
      }
      const result = terminal.send(transfer.resourceType, transfer.amount, transfer.destinationRoomName)
      switch (result) {
      case ERR_TIRED:
        return
      case OK:
      case ERR_NOT_OWNER:
      case ERR_NOT_ENOUGH_RESOURCES:
      case ERR_INVALID_ARGS:
        resourceTransfer.shift()
        return
      }
    })

    if (sentResources.length > 0) {
      const dryRun = this.processState.dryRun === true ? " (dry run):" : ":"
      processLog(this, `Resource sent${dryRun}\n${sentResources.map(resource => `- ${roomLink(resource.fromRoomName)} =&gt ${roomLink(resource.destinationRoomName)} ${resource.amount} ${coloredResourceType(resource.resourceType)}`).join("\n")}`)
    }
  }
}

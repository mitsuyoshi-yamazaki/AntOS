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

ProcessDecoder.register("Season41076620ResourceManagerProcess", state => {
  return Season41076620ResourceManagerProcess.decode(state as Season41076620ResourceManagerProcessState)
})

type ResourceTransfer = {
  readonly resourceType: ResourceConstant
  readonly amount: number
  readonly destinationRoomName: RoomName
}

const terminalMinimumFreeSpace = 10000
const runInterval = 2000
const terminalCooldownInterval = GameConstants.structure.terminal.cooldown + 1

export interface Season41076620ResourceManagerProcessState extends ProcessState {
  readonly resourceTransfer: {[roomName: string]: ResourceTransfer[]}
  readonly processState: {
    readonly dryRun: boolean
    readonly runNextTick: boolean
    readonly lastRunTimestamp: Timestamp  // (Game.time % runInterval) === lastRunTimestamp
  }
}

/**
 * - 最適計算はむずいので余ったResourceで作れる限りHigher Tier Commodityを生産する
 * - Factory Levelに応じたCommodity生産
 * - for Research
 * - for Boost
 * - attacked
 * - powerは均等に
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
    }
  }

  public static decode(state: Season41076620ResourceManagerProcessState): Season41076620ResourceManagerProcess {
    return new Season41076620ResourceManagerProcess(state.l, state.i, state.processState, state.resourceTransfer)
  }

  public static create(processId: ProcessId): Season41076620ResourceManagerProcess {
    const processState = {
      dryRun: true,
      runNextTick: false,
      lastRunTimestamp: Game.time
    }
    return new Season41076620ResourceManagerProcess(Game.time, processId, processState, {})
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
    const roomDescriptions = Array.from(Object.entries(this.resourceTransfer)).flatMap(([roomName, resourceTransferList]): string[] => {
      if (resourceTransferList.length <= 0) {
        return []
      }
      const roomDescription: string[] = [
        `- ${roomLink(roomName)}`,
        ...resourceTransferList.map(resourceTransfer => `  - ${roomLink(resourceTransfer.destinationRoomName)}: ${resourceTransfer.amount} ${coloredResourceType(resourceTransfer.resourceType)}`)
      ]

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
    const commandList = ["help", "add_boosts", "remove_boosts", "status", "run_next_tick", "set_dry_run"]
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
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  // /** @throws */
  // private addBoostCompound(boostType: MineralBoostConstant, amount: ProductAmount): string {
  //   if (this.production.boosts.some(boost => boost.productType === boostType) === true) {
  //     throw `${coloredResourceType(boostType)} is already in the list`
  //   }
  //   this.production.boosts.push({
  //     productType: boostType,
  //     amount,
  //   })
  //   return `${coloredResourceType(boostType)} (${amount}) set`
  // }

  // /** @throws */
  // private addBoosts(args: string[]): string {
  //   throw "not implemented" // TODP:
  // }

  public runOnTick(): void {
    if ((Game.time % terminalCooldownInterval) === 0) {
      this.transferResources()
    }
    if ((this.processState.runNextTick !== true) && ((Game.time % runInterval) !== this.processState.lastRunTimestamp)) {
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
    OperatingSystem.os.listAllProcesses().forEach(processInfo => {
      const process = processInfo.process
      if (process instanceof PowerProcessProcess) {
        powerProcessingRoomNames.push(process.parentRoomName)
        return
      }
      // TODO:
    })

    this.calculatePowerTransfer(allRoomResources, powerProcessingRoomNames)
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
      const terminal = roomResource?.activeStructures.terminal
      if (terminal == null || terminal.cooldown > 0) {
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

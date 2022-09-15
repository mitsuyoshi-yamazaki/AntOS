import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { RoomResources } from "room_resource/room_resources"
import { processLog } from "os/infrastructure/logger"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

const excludedResources: ResourceConstant[] = [
  RESOURCE_ENERGY,
]

ProcessDecoder.register("SellResourcesProcess", state => {
  return SellResourcesProcess.decode(state as SellResourcesProcessState)
})

export interface SellResourcesProcessState extends ProcessState {
  readonly dryRun: boolean
}

export class SellResourcesProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private dryRun: boolean,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): SellResourcesProcessState {
    return {
      t: "SellResourcesProcess",
      l: this.launchTime,
      i: this.processId,
      dryRun: this.dryRun,
    }
  }

  public static decode(state: SellResourcesProcessState): SellResourcesProcess {
    return new SellResourcesProcess(state.l, state.i, state.dryRun)
  }

  public static create(processId: ProcessId): SellResourcesProcess {
    return new SellResourcesProcess(Game.time, processId, true)
  }

  // public processShortDescription(): string {
  //   return ""
  // }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "dry_run"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "dry_run": {
        const listArguments = new ListArguments(components)
        const oldValue = this.dryRun
        const dryRun = listArguments.boolean(0, "dry run").parse()

        this.dryRun = dryRun
        return `set dry run ${oldValue} => ${this.dryRun}`
      }

      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }
  public runOnTick(): void {
    const results = RoomResources.getOwnedRoomResources().flatMap((roomResource): string[] => {
      const terminal = roomResource.activeStructures.terminal
      if (terminal == null) {
        return []
      }
      return this.runWith(terminal)
    })

    if (results.length > 0) {
      if (results.length > 1) {
        results.unshift("")
      }
      processLog(this, results.join("\n"))
    }
  }

  private runWith(terminal: StructureTerminal): string[] {
    if (terminal.cooldown > 0) {
      return []
    }
    if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 10000) {
      return [
        `lack of energy in ${roomLink(terminal.room.name)}`
      ]
    }

    const results: string[] = []
    const resources = Array.from(Object.entries(terminal.store)) as [[ResourceConstant, number]]

    for (const [resourceType, amount] of resources) {
      if (excludedResources.includes(resourceType) === true) {
        continue
      }

      const orders = Game.market.getAllOrders({ resourceType, type: ORDER_BUY }).filter(order => order.remainingAmount > 0)
      orders.sort((lhs, rhs) => rhs.price - lhs.price)

      const highestPriceOrder = orders[0]
      if (highestPriceOrder == null) {
        results.push(`no ${coloredResourceType(resourceType)} buy order`)
        continue
      }

      const sellAmount = Math.min(amount, highestPriceOrder.remainingAmount)
      if (sellAmount <= 0) {
        PrimitiveLogger.programError(`${this.taskIdentifier} too small sell amount ${sellAmount} (order ID: ${highestPriceOrder.id}, remaining: ${highestPriceOrder.remainingAmount}, ${coloredResourceType(resourceType)} in terminal: ${amount} in ${roomLink(terminal.room.name)})`)
        continue
      }

      const soldMessage = `${sellAmount} ${coloredResourceType(resourceType)} sold from ${roomLink(terminal.room.name)}, order ID: ${highestPriceOrder.id}`
      if (this.dryRun === true) {
        results.push(`[Dry Run] ${soldMessage}`)
        break
      }

      const dealResult = Game.market.deal(highestPriceOrder.id, sellAmount, terminal.room.name)

      switch (dealResult) {
      case OK:
        results.push(soldMessage)
        break

      case ERR_NOT_ENOUGH_RESOURCES:
        continue

      case ERR_NOT_OWNER:
      case ERR_FULL:
      case ERR_INVALID_ARGS:  // The arguments provided are invalid.
      case ERR_TIRED:
      default:
        PrimitiveLogger.programError(`${this.taskIdentifier} order failed with ${dealResult} (order ID: ${highestPriceOrder.id}, remaining: ${highestPriceOrder.remainingAmount}, ${coloredResourceType(resourceType)} in terminal: ${amount} in ${roomLink(terminal.room.name)})`)
        break
      }
      break
    }

    return results
  }
}

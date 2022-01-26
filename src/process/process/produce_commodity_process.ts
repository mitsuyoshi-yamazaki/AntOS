import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredResourceType, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { generateCodename } from "utility/unique_id"
import { MessageObserver } from "os/infrastructure/message_observer"
import { isCommodityConstant } from "utility/resource"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"

ProcessDecoder.register("ProduceCommodityProcess", state => {
  return ProduceCommodityProcess.decode(state as ProduceCommodityProcessState)
})

type ProductInfo = {
  readonly commodityType: CommodityConstant
  readonly amount: number
}

interface ProduceCommodityProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly factoryId: Id<StructureFactory>
  readonly products: ProductInfo[]
}

export class ProduceCommodityProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly factoryId: Id<StructureFactory>,
    private products: ProductInfo[],
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): ProduceCommodityProcessState {
    return {
      t: "ProduceCommodityProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      factoryId: this.factoryId,
      products: this.products,
    }
  }

  public static decode(state: ProduceCommodityProcessState): ProduceCommodityProcess {
    return new ProduceCommodityProcess(state.l, state.i, state.roomName, state.factoryId, state.products)
  }

  public static create(processId: ProcessId, roomName: RoomName, factoryId: Id<StructureFactory>): ProduceCommodityProcess {
    return new ProduceCommodityProcess(Game.time, processId, roomName, factoryId, [])
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)}, ${this.products.map(product => coloredResourceType(product.commodityType)).join(",")}`
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "add", "clear"]
    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `
- help
  - shows help
- add &ltcommodity type&gt &ltamount&gt
  - adds product
- clear
  - clears all products
        `

    case "add": {
      try {
        const listArguments = new ListArguments(components)
        const commodityType = listArguments.string(0, "commodity type").parse()
        if (!isCommodityConstant(commodityType)) {
          throw `${commodityType} is not commodity type`
        }
        const amount = listArguments.int(1, "amount").parse()
        this.products.push({ commodityType, amount })
        return `Added ${amount} ${coloredResourceType(commodityType)}`

      } catch (error) {
        return `${error}`
      }
    }

    case "clear": {
      const oldValue = [...this.products]
      this.products = []
      return `Products cleared (old values: ${oldValue.map(product => coloredResourceType(product.commodityType)).join(",")})`
    }

    default:
      return `Invalid command ${commandList}. see "help"`
    }
  }

  public runOnTick(): void {
    // TODO:
  }
}

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredResourceType, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { generateCodename } from "utility/unique_id"
import { MessageObserver } from "os/infrastructure/message_observer"
import { CommodityIngredient, isCommodityConstant } from "utility/resource"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { processLog } from "os/infrastructure/logger"
import { World } from "world_info/world_info"
import { RoomResources } from "room_resource/room_resources"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepBody } from "utility/creep_body"

ProcessDecoder.register("ProduceCommodityProcess", state => {
  return ProduceCommodityProcess.decode(state as ProduceCommodityProcessState)
})

const noProduct = "no products"

type ProductInfo = {
  readonly commodityType: CommodityConstant
  readonly amount: number
  readonly ingredients: CommodityIngredient[]
}

interface ProduceCommodityProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly factoryId: Id<StructureFactory>
  readonly products: ProductInfo[]
  readonly stopSpawningReasons: string[]
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
    private stopSpawningReasons: string[]
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
      stopSpawningReasons: this.stopSpawningReasons,
    }
  }

  public static decode(state: ProduceCommodityProcessState): ProduceCommodityProcess {
    return new ProduceCommodityProcess(state.l, state.i, state.roomName, state.factoryId, state.products, state.stopSpawningReasons)
  }

  public static create(processId: ProcessId, roomName: RoomName, factoryId: Id<StructureFactory>): ProduceCommodityProcess {
    return new ProduceCommodityProcess(Game.time, processId, roomName, factoryId, [], [])
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName),
      this.products.map(product => coloredResourceType(product.commodityType)).join(","),
    ]
    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`spawning stopped due to: ${this.stopSpawningReasons.join(", ")}`)
    }
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "add", "clear", "stop", "resume"]
    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "help":
      return `
- help
  - shows help
- status
  - shows current status and products
- add &ltcommodity type&gt &ltamount&gt
  - adds product
- clear
  - clears all products
- stop
  - manually stop spawning
- resume
  - resume spawning
        `

    case "status": {
      const products = this.products.map(product => {
        const commodityType = coloredResourceType(product.commodityType)
        const ingredients = product.ingredients.map(ingredient => coloredResourceType(ingredient)).join(",")
        return `- ${product.amount} ${commodityType} (${ingredients})`
      }).join("\n")
      const descriptions: string[] = [
        `products:\n${products}`,
      ]
      if (this.stopSpawningReasons.length > 0) {
        descriptions.push(`stop spawning reasons:\n${this.stopSpawningReasons.map(reason => `- ${reason}`).join("\n")}`)
      }
      return descriptions.join("\n")
    }

    case "add": {
      try {
        const listArguments = new ListArguments(components)
        const commodityType = listArguments.string(0, "commodity type").parse()
        if (!isCommodityConstant(commodityType)) {
          throw `${commodityType} is not commodity type`
        }
        const amount = listArguments.int(1, "amount").parse()
        this.products.push({
          commodityType,
          amount,
          ingredients: Array.from(Object.keys(COMMODITIES[commodityType].components)) as CommodityIngredient[],
        })
        const noProductIndex = this.stopSpawningReasons.indexOf(noProduct)
        if (noProductIndex >= 0) {
          this.stopSpawningReasons.splice(noProductIndex, 1)
        }
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

    case "stop":
      this.addSpawnStopReason("manually stopped")
      return "Stopped spawning"

    case "resume": {
      const oldValue = [...this.stopSpawningReasons]
      this.stopSpawningReasons = []
      return `Resume spawning (stopped reasons: ${oldValue.join(", ")})`
    }

    default:
      return `Invalid command ${commandList}. see "help"`
    }
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const product = this.products[0]
    if (product == null) {
      this.addSpawnStopReason(noProduct)
    }

    const factory = Game.getObjectById(this.factoryId)
    if (factory == null) {
      this.addSpawnStopReason("no factory")
      processLog(this, `No factory in ${roomLink(this.roomName)}`)
      return
    }

    const terminal = roomResource.activeStructures.terminal
    if (terminal != null && product != null && terminal.store.getUsedCapacity(product.commodityType) >= product.amount) {
      this.products.shift()
      return
    }

    const shouldSpawn = ((): boolean => {
      if (this.stopSpawningReasons.length > 0) {
        return false
      }
      const creepCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)
      if (creepCount > 0) {
        return false
      }
      if (terminal == null || product == null) {
        return false
      }
      if (this.hasIngredientsIn(terminal, product) !== true) {
        return false
      }
      return true
    })()

    if (shouldSpawn === true) {
      this.spawnHauler(roomResource.room.energyCapacityAvailable)
    }

    if (terminal != null && product != null) {
      this.produce(factory, product)

      World.resourcePools.assignTasks(
        this.roomName,
        this.taskIdentifier,
        CreepPoolAssignPriority.Low,
        creep => this.newHaulerTask(creep, factory, terminal, product),
        () => true,
      )
    }
  }

  private hasIngredientsIn(terminal: StructureTerminal, product: ProductInfo): boolean {
    return product.ingredients.some(ingredient => terminal.store.getUsedCapacity(ingredient) > 0)
  }

  private spawnHauler(energyCapacity: number): void {
    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [],
      body: CreepBody.create([], [CARRY, CARRY, MOVE], energyCapacity, 4),
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    })
  }

  private newHaulerTask(creep: Creep, factory: StructureFactory, terminal: StructureTerminal, product: ProductInfo): CreepTask | null {
    const resourceType = Array.from(Object.keys(creep.store))[0] as ResourceConstant | null
    if (resourceType != null) {
      if ((product.ingredients as string[]).includes(resourceType) === true) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(factory, resourceType))
      }
      return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, resourceType))
    }

    if (creep.ticksToLive != null && creep.ticksToLive < 25) {
      return RunApiTask.create(SuicideApiWrapper.create())
    }

    const withdrawResourceType = this.resourceTypeToWithdraw(factory, product)
    if (withdrawResourceType != null) {
      const tasks: CreepTask[] = [
        MoveToTargetTask.create(WithdrawResourceApiWrapper.create(factory, withdrawResourceType)),
        MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, withdrawResourceType)),
      ]
      return SequentialTask.create(tasks, {ignoreFailure: false, finishWhenSucceed: false})
    }

    const chargeResourceType = this.resourceTypeToCharge(factory, terminal, product)
    if (chargeResourceType != null) {
      const tasks: CreepTask[] = [
        MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, chargeResourceType)),
        MoveToTargetTask.create(TransferResourceApiWrapper.create(factory, chargeResourceType)),
      ]
      return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
    } else {
      this.addSpawnStopReason("no ingredients")
    }

    creep.say("zzZ")
    return null
  }

  private resourceTypeToWithdraw(factory: StructureFactory, product: ProductInfo): ResourceConstant | null {
    return (Array.from(Object.keys(factory.store)) as ResourceConstant[])
      .filter(resourceType => {
        if (resourceType === product.commodityType) {
          return true
        }
        if ((product.ingredients as string[]).includes(resourceType) === true) {
          return false
        }
        return true
      })[0] ?? null
  }

  private resourceTypeToCharge(factory: StructureFactory, terminal: StructureTerminal, product: ProductInfo): ResourceConstant | null {
    const threshold = 10000
    if (factory.store.getUsedCapacity() > threshold) {
      return null
    }

    const resourceAmount: { resourceType: ResourceConstant, amount: number }[] = product.ingredients.flatMap(resourceType => {
      if (terminal.store.getUsedCapacity(resourceType) <= 0) {
        return []
      }
      return [{
        resourceType,
        amount: factory.store.getUsedCapacity(resourceType),
      }]
    })

    if (resourceAmount.length <= 0) {
      return null
    }

    return resourceAmount.reduce((result, current) => {
      return current.amount < result.amount ? current : result
    }).resourceType
  }

  private produce(factory: StructureFactory, product: ProductInfo): void {
    const result = factory.produce(product.commodityType)
    switch (result) {
    case OK:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_TIRED:
      break

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.programError(`${this.identifier} factory.produce(${coloredResourceType(product.commodityType)}) failed with ${result}`)
      break

    case ERR_FULL:
      processLog(this, "factory is full")
      break

    case ERR_BUSY:
    case ERR_INVALID_TARGET:
      this.addSpawnStopReason(`invalid product (${result})`)
      break
    }
  }

  private addSpawnStopReason(reason: string): void {
    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
  }
}

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { generateCodename } from "utility/unique_id"
import { MessageObserver } from "os/infrastructure/message_observer"
import { CommodityIngredient, getCommodityTier, CommodityTier, commodityTiers, commodityTypesForTier, isCommodityConstant, isDepositConstant } from "utility/resource"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
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
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { GameConstants } from "utility/constants"

ProcessDecoder.register("ContinuouslyProduceCommodityProcess", state => {
  return ContinuouslyProduceCommodityProcess.decode(state as ContinuouslyProduceCommodityProcessState)
})

const noProduct = "no products"
const notOperating = "not operating"

const finished = false as boolean // Season4終了時の条件と思われ

type IngredientMinimumAmounts = {[resourceType: string]: number}

interface ContinuouslyProduceCommodityProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly factoryId: Id<StructureFactory>
  readonly products: CommodityConstant[]
  readonly excludedProducts: CommodityConstant[]
  readonly ingredientMinimumAmounts: IngredientMinimumAmounts
  readonly stopSpawningReasons: string[]
}

/**
 * - 詰まったら止める
 */
export class ContinuouslyProduceCommodityProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly factoryId: Id<StructureFactory>,
    private products: CommodityConstant[],
    private excludedProducts: CommodityConstant[],
    private ingredientMinimumAmounts: IngredientMinimumAmounts,
    private stopSpawningReasons: string[]
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): ContinuouslyProduceCommodityProcessState {
    return {
      t: "ContinuouslyProduceCommodityProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      factoryId: this.factoryId,
      products: this.products,
      excludedProducts: this.excludedProducts,
      ingredientMinimumAmounts: this.ingredientMinimumAmounts,
      stopSpawningReasons: this.stopSpawningReasons,
    }
  }

  public static decode(state: ContinuouslyProduceCommodityProcessState): ContinuouslyProduceCommodityProcess {
    return new ContinuouslyProduceCommodityProcess(state.l, state.i, state.roomName, state.factoryId, state.products, state.excludedProducts, state.ingredientMinimumAmounts, state.stopSpawningReasons)
  }

  public static create(processId: ProcessId, roomName: RoomName, factory: StructureFactory, options?: { products?: CommodityConstant[] }): ContinuouslyProduceCommodityProcess {
    const [excludedProducts, products] = ((): [CommodityConstant[], CommodityConstant[]] => {
      if (options?.products != null) {
        const givenProducts = options?.products
        const excluded = productsForFactory(factory, []).filter(product => givenProducts.includes(product) !== true)
        return [
          excluded,
          givenProducts,
        ]
      }
      const defaultExcludedProducts: CommodityConstant[] = [RESOURCE_BATTERY]
      return [
        defaultExcludedProducts,
        productsForFactory(factory, defaultExcludedProducts),
      ]
    })()

    const ingredientMinimumAmounts: IngredientMinimumAmounts = {}
    const stopSpawningReasons: string[] = []

    return new ContinuouslyProduceCommodityProcess(
      Game.time,
      processId,
      roomName,
      factory.id,
      products,
      excludedProducts,
      ingredientMinimumAmounts,
      stopSpawningReasons,
    )
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName),
      this.products.map(product => coloredResourceType(product)).join(","),
    ]
    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`spawning stopped due to: ${this.stopSpawningReasons.join(", ")}`)
    }
    return descriptions.join(" ")
  }

  public processDescription(): string {
    const products = this.products.map(commodityType => coloredResourceType(commodityType)).join(", ")
    const excludedProducts = this.excludedProducts.map(commodityType => coloredResourceType(commodityType)).join(", ")
    const ingredients = this.getAllIngredients().map(commodityType => coloredResourceType(commodityType)).join(", ")
    const minimumAmounts = Array.from(Object.entries(this.ingredientMinimumAmounts)).map(([resourceType, amount]) => `${coloredResourceType(resourceType as ResourceConstant)} ${amount}`).join(", ")

    const descriptions: string[] = [
      `${roomLink(this.roomName)}`,
      `- products: ${products}`,
      `- excluded: ${excludedProducts}`,
      `- total ingredients: ${ingredients}`,
      `- minimum amounts: ${minimumAmounts}`
    ]
    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`stop spawning reasons:\n${this.stopSpawningReasons.map(reason => `- ${reason}`).join("\n")}`)
    }
    return descriptions.join("\n")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status", "add_excluded_products", "clear_excluded_products", "set_minimum_amount", "verify", "stop", "resume"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        return this.processDescription()

      case "add_excluded_products": {
        const listArguments = new ListArguments(components)
        const excludedProducts = listArguments.list(0, "excluded products", "commodity").parse()
        excludedProducts.forEach(commodityType => {
          if (this.excludedProducts.includes(commodityType) === true) {
            return
          }
          this.excludedProducts.push(commodityType)
        })
        const factory = Game.getObjectById(this.factoryId)
        if (factory == null) {
          throw `missing factory with ID ${this.factoryId} in ${roomLink(this.roomName)}`
        }
        this.products = this.recalculatedProducts(factory)
        return `total excluded products: ${this.excludedProducts.map(commodityType => coloredResourceType(commodityType)).join(",")}`
      }

      case "clear_excluded_products": {
        const oldValue = [...this.excludedProducts]
        this.excludedProducts = []
        const factory = Game.getObjectById(this.factoryId)
        if (factory == null) {
          throw `missing factory with ID ${this.factoryId} in ${roomLink(this.roomName)}`
        }
        this.products = this.recalculatedProducts(factory)
        return `excluded products cleared (old values: ${oldValue.map(commodityType => coloredResourceType(commodityType)).join(",")}`
      }

      case "set_minimum_amount": {
        const listArguments = new ListArguments(components)
        const ingredient = listArguments.resourceType(0, "ingredient type").parse()
        const amount = listArguments.int(1, "amount").parse({ min: 0, max: GameConstants.structure.terminal.capacity })
        this.setResourceMinimumAmount(ingredient, amount)

        return `set ${coloredResourceType(ingredient)} minimum amount ${amount}`
      }

      case "verify": {
        const allIngredients = this.getAllIngredients()
        const overlap: CommodityIngredient[] = []
        this.products.forEach(product => {
          if (allIngredients.includes(product) === true) {
            overlap.push(product)
            return
          }
        })

        if (overlap.length > 0) {
          throw `${overlap.map(resourceType => coloredResourceType(resourceType)).join(",")} are product and ingredient`
        }
        return "ok"
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
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public setResourceMinimumAmount(resourceType: ResourceConstant, amount: number): void {
    this.ingredientMinimumAmounts[resourceType] = amount
  }

  public clearResourceMinimumAmounts(): void {
    this.ingredientMinimumAmounts = {}
  }

  public requiredIngredients(): CommodityIngredient[] {
    return this.getAllIngredients()
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const allIngredients = this.getAllIngredients()

    const retrievedFactory = Game.getObjectById(this.factoryId)
    if (retrievedFactory == null) {
      this.addSpawnStopReason("no factory")
      processLog(this, `No factory in ${roomLink(this.roomName)}`)
      return
    }
    const factory = retrievedFactory

    const notOperatingReasonIndex = this.stopSpawningReasons.indexOf(notOperating)
    if (notOperatingReasonIndex >= 0) {
      if (factory.effects != null && factory.effects.some(effect => effect.effect === PWR_OPERATE_FACTORY) === true) {
        this.stopSpawningReasons.splice(notOperatingReasonIndex, 1)
      }
    }

    const minimumEnergy = ((): number => {
      const defaultMinimumEnergy = 70000
      if (factory.level == null) {
        return defaultMinimumEnergy
      }
      if (factory.level <= 0) {
        return defaultMinimumEnergy
      }
      return 60000
    })()

    const hasEnoughEnergy = roomResource.getResourceAmount(RESOURCE_ENERGY) > minimumEnergy
    const terminal = roomResource.activeStructures.terminal

    const shouldSpawn = ((): boolean => {
      if (this.products.length <= 0) {
        return false
      }
      if (hasEnoughEnergy !== true) {
        return false
      }
      if (this.stopSpawningReasons.length > 0) {
        return false
      }
      const creepCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)
      if (creepCount > 0) {
        return false
      }
      if (terminal == null) {
        return false
      }
      if (this.hasIngredients(roomResource, allIngredients) !== true) {
        return false
      }
      return true
    })()

    if (shouldSpawn === true) {
      this.spawnHauler(roomResource.room.energyCapacityAvailable, getFactoryTier(factory))
    }

    if (terminal != null) {
      if (this.products.length > 0 && hasEnoughEnergy === true) {
        this.produce(factory, roomResource)
      }

      World.resourcePools.assignTasks(
        this.roomName,
        this.taskIdentifier,
        CreepPoolAssignPriority.Low,
        creep => this.newHaulerTask(creep, factory, terminal, allIngredients, roomResource),
        () => true,
      )
    }
  }

  private spawnHauler(energyCapacity: number, tier: CommodityTier): void {
    const carryCapacity = ((): number => {
      switch (tier) {
      case 0:
        return 700
      case 1:
      case 2:
      case 3:
      case 4:
      case 5:
        return 200
      }
    })()
    const maxBodyUnitCount = Math.ceil(carryCapacity / 100)
    const body = CreepBody.create([], [CARRY, CARRY, MOVE], energyCapacity, maxBodyUnitCount)

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [],
      body,
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: null,
    })
  }

  private newHaulerTask(creep: Creep, factory: StructureFactory, terminal: StructureTerminal, allIngredients: CommodityIngredient[], roomResource: OwnedRoomResource): CreepTask | null {
    const resourceType = Array.from(Object.keys(creep.store))[0] as ResourceConstant | null
    if (resourceType != null) {
      if ((allIngredients as string[]).includes(resourceType) === true && finished !== true) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(factory, resourceType))
      }
      return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, resourceType))
    }

    if (creep.ticksToLive != null && creep.ticksToLive < 25) {
      return RunApiTask.create(SuicideApiWrapper.create())
    }

    const chargeResourceType = this.resourceTypeToChargeFactory(factory, allIngredients, roomResource)
    if (creep.pos.isNearTo(terminal) === true) {
      if (chargeResourceType != null) {
        const tasks: CreepTask[] = [
          MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, chargeResourceType)),
          MoveToTargetTask.create(TransferResourceApiWrapper.create(factory, chargeResourceType)),
        ]
        return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
      }
    }
    const withdrawResource = this.resourceToWithdraw(factory, allIngredients)
    if (withdrawResource != null && withdrawResource.amount > 200) {
      const tasks: CreepTask[] = [
        MoveToTargetTask.create(WithdrawResourceApiWrapper.create(factory, withdrawResource.resourceType)),
        MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, withdrawResource.resourceType)),
      ]
      return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
    }

    if (chargeResourceType != null) {
      const tasks: CreepTask[] = [
        MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, chargeResourceType)),
        MoveToTargetTask.create(TransferResourceApiWrapper.create(factory, chargeResourceType)),
      ]
      return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
    }

    if (withdrawResource != null) {
      const tasks: CreepTask[] = [
        MoveToTargetTask.create(WithdrawResourceApiWrapper.create(factory, withdrawResource.resourceType)),
        MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, withdrawResource.resourceType)),
      ]
      return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
    }

    const moveToWaitingPositionTask = this.moveToWaitingPositionTask(roomResource)
    if (moveToWaitingPositionTask != null) {
      return moveToWaitingPositionTask
    }

    creep.say("zzZ")
    return null
  }

  private moveToWaitingPositionTask(roomResource: OwnedRoomResource): CreepTask | null {
    const waitingPosition = roomResource.roomInfoAccessor.config.getGenericWaitingPosition()
    if (waitingPosition == null) {
      return null
    }
    return MoveToTask.create(waitingPosition, 0)
  }

  private resourceToWithdraw(factory: StructureFactory, allIngredients: CommodityIngredient[]): { resourceType: ResourceConstant, amount: number } | null {
    const resources = (Array.from(Object.keys(factory.store)) as ResourceConstant[])
    if (finished === true) {
      const resourceType = resources[0]
      if (resourceType == null) {
        return null
      }
      return {
        resourceType,
        amount: factory.store.getUsedCapacity(resourceType)
      }
    }

    const resourceTypesToWithdraw = resources
      .flatMap((resourceType): { resourceType: ResourceConstant, amount: number }[] => {
        const amount = factory.store.getUsedCapacity(resourceType)
        if ((allIngredients as ResourceConstant[]).includes(resourceType) === true) {
          return []
        }
        return [{
          resourceType,
          amount,
        }]
      })

    resourceTypesToWithdraw.sort((lhs, rhs) => {
      return rhs.amount - lhs.amount
    })
    if (resourceTypesToWithdraw[0] == null) {
      return null
    }
    return resourceTypesToWithdraw[0]
  }

  private chargeMaximumAmountInFactory(resourceType: ResourceConstant): number {
    if (isDepositConstant(resourceType)) {
      return 1000
    }
    if (resourceType === RESOURCE_COMPOSITE) {
      return 20
    }
    if (resourceType === RESOURCE_LIQUID) {
      return 150
    }
    if (isCommodityConstant(resourceType)) {
      const tier = getCommodityTier(resourceType)
      switch (tier) {
      case 0:
        return 310
      case 1:
        return 45
      case 2:
        return 5
      case 3:
        return 3
      case 4:
      case 5:
        return 1
      }
    }
    return 2000
  }

  private resourceTypeToChargeFactory(factory: StructureFactory, allIngredients: CommodityIngredient[], roomResource: OwnedRoomResource): CommodityIngredient | null {
    if (finished === true) {
      return null
    }

    // factory内にmaximumAmountInFactory未満で、かつterminalに0以上のresourceを、factory内に少ない順
    const ingredientAmounts = allIngredients.flatMap((ingredient): { ingredient: CommodityIngredient, amountInFactory: number }[] => {
      const amountInFactory = factory.store.getUsedCapacity(ingredient)
      if (amountInFactory >= this.chargeMaximumAmountInFactory(ingredient)) {
        return []
      }

      const minimumAmount = this.getIngredientMinimumAmount(ingredient)
      const availableAmount = roomResource.getResourceAmount(ingredient) - minimumAmount
      if (availableAmount <= 0) {
        return []
      }

      return [{
        ingredient,
        amountInFactory,
      }]
    })

    if (ingredientAmounts.length <= 0) {
      return null
    }

    const ingredient = ingredientAmounts.reduce((result, current) => {
      return current.amountInFactory < result.amountInFactory ? current : result
    })
    return ingredient.ingredient
  }

  private produce(factory: StructureFactory, roomResource: OwnedRoomResource): void {
    if (factory.cooldown > 0) {
      return
    }

    const product = this.products.find(product => {
      return this.hasEnoughIngredientsIn(factory, product)
    })
    if (product == null) {
      roomResource.roomInfoAccessor.config.disablePower(PWR_OPERATE_FACTORY)
      return
    }

    const result = factory.produce(product)
    switch (result) {
    case OK:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_TIRED:
      roomResource.roomInfoAccessor.config.disablePower(PWR_OPERATE_FACTORY)
      break

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.programError(`${this.identifier} factory.produce(${coloredResourceType(product)}) failed with ${result}`)
      break

    case ERR_FULL:
      processLog(this, "factory is full")
      break

    case ERR_INVALID_TARGET:
    case ERR_BUSY:
      this.addSpawnStopReason(notOperating)
      roomResource.roomInfoAccessor.config.enablePower(PWR_OPERATE_FACTORY)
      break
    }
  }

  // ---- Utility ---- //
  private getAllIngredients(): CommodityIngredient[] {
    const results: CommodityIngredient[] = []
    this.products.forEach(product => {
      const productInfo = COMMODITIES[product]
      Array.from(Object.keys(productInfo.components)).forEach(ingredient => {
        const commodityIngredient = ingredient as CommodityIngredient
        if (results.includes(commodityIngredient) === true) {
          return
        }
        results.push(commodityIngredient)
      })
    })

    return results
  }

  private recalculatedProducts(factory: StructureFactory): CommodityConstant[] {
    return productsForFactory(factory, this.excludedProducts)
  }

  private hasIngredients(roomResource: OwnedRoomResource, allIngredients: CommodityIngredient[]): boolean {
    return allIngredients.some(ingredient => {
      const minimumAmount = this.getIngredientMinimumAmount(ingredient)
      if (roomResource.getResourceAmount(ingredient) > minimumAmount) {
        return true
      }
      return false
    })
  }

  private hasEnoughIngredientsIn(factory: StructureFactory, productType: CommodityConstant): boolean {
    const ingredients = Array.from(Object.entries(COMMODITIES[productType].components))

    return ingredients.every(([ingredientType, amount]) => {
      return factory.store.getUsedCapacity(ingredientType as ResourceConstant) >= amount
    })
  }

  private getIngredientMinimumAmount(ingredient: CommodityIngredient): number {
    return this.ingredientMinimumAmounts[ingredient] ?? 0
  }

  private addSpawnStopReason(reason: string): void {
    if (reason === noProduct) {
      const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
      if (roomResource != null) {
        roomResource.roomInfoAccessor.config.disablePower(PWR_OPERATE_FACTORY)
      }
    }

    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
  }
}

function getFactoryTier(factory: StructureFactory): CommodityTier {
  if (factory.level == null) {
    return 0
  }
  if ((commodityTiers as (readonly number[])).includes(factory.level) !== true) {
    return 0
  }
  return factory.level as CommodityTier
}

function productsForFactory(factory: StructureFactory, excludedProducts: CommodityConstant[]): CommodityConstant[] {
  const tier = getFactoryTier(factory)

  return commodityTypesForTier(tier).flatMap(commodityType => {
    if (excludedProducts.includes(commodityType) === true) {
      return []
    }
    return [commodityType]
  })
}

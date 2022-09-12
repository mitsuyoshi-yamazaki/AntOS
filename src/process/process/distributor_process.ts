import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { decodeRoomPosition } from "prototype/room_position"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "os/infrastructure/logger"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { isResourceConstant } from "shared/utility/resource"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { CreepBody } from "utility/creep_body"
import { GameConstants } from "utility/constants"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"

ProcessDecoder.register("DistributorProcess", state => {
  return DistributorProcess.decode(state as DistributorProcessState)
})

type EnergyStore = StructureTerminal | StructureStorage

export interface DistributorProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  drainStorage: boolean
}

export class DistributorProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private shouldWithdrawLink = false

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private drainStorage: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): DistributorProcessState {
    return {
      t: "DistributorProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      drainStorage: this.drainStorage,
    }
  }

  public static decode(state: DistributorProcessState): DistributorProcess {
    return new DistributorProcess(state.l, state.i, state.p, state.drainStorage)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName): DistributorProcess {
    return new DistributorProcess(Game.time, processId, parentRoomName, false)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public setDrainStorage(): void {
    processLog(this, `${coloredText("[Warning]", "warn")} ${roomLink(this.parentRoomName)} drain storage`)
    this.drainStorage = true
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "stop_storage_drain"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "stop_storage_drain":
        this.drainStorage = false
        return "stopped"

      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    this.shouldWithdrawLink = ((): boolean => {
      if (resources.roomInfoAccessor.sourceEnergyTransferType.case === "link") {
        return true
      }
      return false
    })()

    const distributorPosition = resources.roomInfo.roomPlan?.centerPosition
    if (distributorPosition == null) {
      PrimitiveLogger.fatal(`${this.identifier} no room plan ${roomLink(this.parentRoomName)}`)
      return
    }
    const distributorRoomPosition = decodeRoomPosition(distributorPosition, this.parentRoomName)

    if ((Game.time % 29) === 13) {
      this.checkLink(resources)
    }

    const link = resources.roomInfoAccessor.links.core
    const upgraderLink = resources.roomInfoAccessor.links.upgrader
    if (link != null && upgraderLink != null) {
      this.runLinks(link, upgraderLink, resources)
    }

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier)
    if (creepCount < 1) {
      if ((resources.controller.level > 4 && resources.activeStructures.storage != null) || resources.activeStructures.terminal != null) {
        const body = ((): BodyPartConstant[] => {
          if (resources.controller.level < 8 || this.drainStorage === true) {
            return CreepBody.create([MOVE], [CARRY], resources.room.energyCapacityAvailable, 16)
          }
          return CreepBody.create([MOVE], [CARRY], resources.room.energyCapacityAvailable, 4)
        })()
        this.requestDistributor(body)
      }
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newDistributorTask(creep, link, resources, distributorRoomPosition),
    )
  }

  private checkLink(resources: OwnedRoomResource): void {
    if (resources.controller.level < 5) {
      return
    }
    if (resources.roomInfoAccessor.links.core == null) {
      const roomPlan = resources.roomInfo.roomPlan
      if (roomPlan != null) {
        const roomCenter = decodeRoomPosition(roomPlan.centerPosition, this.parentRoomName)
        const link = roomCenter.findInRange(FIND_MY_STRUCTURES, 1, { filter: { structureType: STRUCTURE_LINK } })[0] as StructureLink | null
        if (link != null) {
          resources.roomInfoAccessor.setLinkId(link.id, "core")
        }
      }
    }
    if (resources.roomInfoAccessor.links.upgrader == null) {
      const upgraderLink = resources.controller.pos.findInRange(FIND_MY_STRUCTURES, 3, { filter: { structureType: STRUCTURE_LINK } })[0] as StructureLink | null
      if (upgraderLink != null) {
        resources.roomInfoAccessor.setLinkId(upgraderLink.id, "upgrader")
      }
    }
  }

  private requestDistributor(body: BodyPartConstant[]): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runLinks(coreLink: StructureLink, upgraderLink: StructureLink, roomResource: OwnedRoomResource): void {
    if (this.shouldWithdrawLink === true) {
      this.transferEnergyFromSourceLinks(coreLink, upgraderLink, roomResource)
      return
    }

    this.transferEnergyToUpgraderLink(coreLink, upgraderLink, roomResource)
  }

  private transferEnergyFromSourceLinks(coreLink: StructureLink, upgraderLink: StructureLink, roomResource: OwnedRoomResource): void {
    const energyThreshold = GameConstants.link.capaity - 50
    const sourceLinks = Array.from(roomResource.roomInfoAccessor.links.sources.values()).filter(link => {
      if (link.cooldown > 0) {
        return false
      }
      if (link.store.getUsedCapacity(RESOURCE_ENERGY) < energyThreshold) {
        return false
      }
      return true
    })

    const sourceLink = sourceLinks[0]
    if (sourceLink == null) {
      return
    }

    if (upgraderLink.store.getUsedCapacity(RESOURCE_ENERGY) < (upgraderLink.store.getCapacity(RESOURCE_ENERGY) * 0.3)) {
      sourceLink.transferEnergy(upgraderLink)
      return
    }

    if (coreLink.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      sourceLink.transferEnergy(coreLink)
      return
    }
  }

  private transferEnergyToUpgraderLink(coreLink: StructureLink, upgraderLink: StructureLink, roomResource: OwnedRoomResource): void {
    const linkConstants = GameConstants.link
    if (upgraderLink.store.getUsedCapacity(RESOURCE_ENERGY) >= (linkConstants.capaity * linkConstants.loss)) {
      return
    }

    const sourceLinks = Array.from(roomResource.roomInfoAccessor.links.sources.values())
    const energySourceLinks = [
      ...sourceLinks,
      coreLink,
    ].flatMap((link): { link: StructureLink, energyAmount: number }[] => {
      if (link.cooldown > 0) {
        return []
      }
      return [{
        link,
        energyAmount: link.store.getUsedCapacity(RESOURCE_ENERGY),
      }]
    })

    energySourceLinks.sort((lhs, rhs) => rhs.energyAmount - lhs.energyAmount)

    const energySourceLink = energySourceLinks[0]
    if (energySourceLink == null) {
      return
    }
    if (energySourceLink.energyAmount < linkConstants.capaity * 0.5) {
      return
    }
    energySourceLink.link.transferEnergy(upgraderLink)
  }

  private newDistributorTask(creep: Creep, link: StructureLink | null, resources: OwnedRoomResource, position: RoomPosition): CreepTask | null {
    if (creep.pos.isEqualTo(position) !== true) {
      return MoveToTask.create(position, 0)
    }

    if (this.drainStorage === true && resources.activeStructures.terminal != null && resources.activeStructures.terminal.store.getFreeCapacity() > 20000) {
      return this.drainStorageTask(creep, resources)
    }

    const storage = resources.activeStructures.storage
    const terminal = resources.activeStructures.terminal
    if ((terminal == null || creep.pos.isNearTo(terminal.pos) !== true) && storage != null && link != null) {
      if (this.shouldWithdrawLink === true) {
        if (creep.store.getUsedCapacity() <= 0) {
          return RunApiTask.create(WithdrawResourceApiWrapper.create(link, RESOURCE_ENERGY))
        }
        return RunApiTask.create(TransferEnergyApiWrapper.create(storage))
      }
      return this.transferEnergyToLinkTask(creep, storage, link)
    }
    if (storage == null || terminal == null) {
      if (terminal != null && link != null) {
        if (creep.store.getUsedCapacity() <= 0) {
          if (this.shouldWithdrawLink === true && link != null && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            return RunApiTask.create(WithdrawResourceApiWrapper.create(link, RESOURCE_ENERGY))
          }
          return null
        }
        if (this.shouldWithdrawLink === true) {
          return RunApiTask.create(TransferEnergyApiWrapper.create(terminal))
        }
      }
      return null
    }

    const canTransferResource = ((): boolean => {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        return false
      }
      if (creep.store.getUsedCapacity() > 0) {
        return true
      }
      if (link != null) {
        if (this.shouldWithdrawLink === true) {
          if (link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
            return false
          }
        } else {
          if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            return false
          }
        }
      }
      return true
    })()

    if (canTransferResource === true) {
      const resourceTask = this.transferResourceTask(creep, storage, terminal)
      if (resourceTask != null) {
        return resourceTask
      }
    }
    return this.transferEnergyTask(creep, storage, terminal, link, resources)
  }

  private transferResourceTask(creep: Creep, storage: StructureStorage, terminal: StructureTerminal): CreepTask | null {
    if (creep.ticksToLive != null && creep.ticksToLive < 3 && creep.store.getUsedCapacity() <= 0) {
      creep.say("dying")
      return null
    }

    const transferToTerminalResourceType = RESOURCE_OPS
    if (creep.store.getUsedCapacity() <= 0 && storage.store.getUsedCapacity(transferToTerminalResourceType) > 0 && terminal.store.getFreeCapacity(transferToTerminalResourceType) > 10000) {
      return RunApiTask.create(WithdrawResourceApiWrapper.create(storage, transferToTerminalResourceType))
    }

    const terminalAmount = 20000
    const excludedResourceTypes: ResourceConstant[] = [
      RESOURCE_ENERGY,
      // RESOURCE_POWER,
      // RESOURCE_OPS,
      // ...Tier1CommodityConstants,
      // ...Tier2CommodityConstants,
      // ...Tier3CommodityConstants,
      // ...Tier4CommodityConstants,
      // ...Tier5CommodityConstants,
    ]

    const creepResourceType = Object.keys(creep.store)[0]
    if (creepResourceType != null && isResourceConstant(creepResourceType) && creep.store.getUsedCapacity(creepResourceType) > 0) {
      const terminalShortage = terminalAmount - terminal.store.getUsedCapacity(creepResourceType)
      if (terminalShortage > 0) {
        const transferAmount = Math.min(terminalShortage, creep.store.getUsedCapacity(creepResourceType))
        return RunApiTask.create(TransferResourceApiWrapper.create(terminal, creepResourceType, transferAmount))
      }
      return RunApiTask.create(TransferResourceApiWrapper.create(storage, creepResourceType))
    }

    const enoughResources: ResourceConstant[] = []
    const excessResources: ResourceConstant[] = []
    Object.keys(terminal.store).find(resourceType => {
      if (!isResourceConstant(resourceType)) {
        return
      }
      if (excludedResourceTypes.includes(resourceType) === true) {
        return
      }
      const amount = terminal.store.getUsedCapacity(resourceType)
      if (amount > terminalAmount) {
        excessResources.push(resourceType)
        enoughResources.push(resourceType)
        return
      }
      if (amount === terminalAmount) {
        enoughResources.push(resourceType)
        return
      }
    })

    const excessResourceType = excessResources[0]
    if (excessResourceType != null && storage.store.getFreeCapacity(excessResourceType) > 30000) {
      const withdrawAmount = Math.min(terminal.store.getUsedCapacity(excessResourceType) - terminalAmount, creep.store.getFreeCapacity())
      return RunApiTask.create(WithdrawResourceApiWrapper.create(terminal, excessResourceType, withdrawAmount))
    }

    if (terminal.store.getFreeCapacity() < 20000) {
      processLog(this, `Not enough space in ${terminal} ${roomLink(this.parentRoomName)}`)
      return null
    }

    const shortageResourceType = Object.keys(storage.store).find(resourceType => {
      if (!isResourceConstant(resourceType)) {
        return false
      }
      if (excludedResourceTypes.includes(resourceType) === true) {
        return false
      }
      if (enoughResources.includes(resourceType) === true) {
        return false
      }
      return true
    }) as ResourceConstant | null

    if (shortageResourceType != null) {
      const maxAmount = terminalAmount - terminal.store.getUsedCapacity(shortageResourceType)
      const creepCapacity = creep.store.getFreeCapacity()
      const availableAmount = storage.store.getUsedCapacity(shortageResourceType)
      const withdrawAmount = Math.min(Math.min(maxAmount, creepCapacity), availableAmount)
      return RunApiTask.create(WithdrawResourceApiWrapper.create(storage, shortageResourceType, withdrawAmount))
    }
    return null
  }

  private transferEnergyTask(creep: Creep, storage: StructureStorage, terminal: StructureTerminal, link: StructureLink | null, resources: OwnedRoomResource): CreepTask | null {
    const energySources = ((): [EnergyStore, EnergyStore] => {
      const terminalEnergyAmount = terminal.store.getUsedCapacity(RESOURCE_ENERGY)
      const minimumEnergy = 40000
      const needEnergy = resources.roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] != null
      if (needEnergy === true && terminalEnergyAmount >= minimumEnergy) {
        return [terminal, storage]
      } else {
        return [storage, terminal]
      }
    })()
    if (energySources == null) {
      return null
    }
    const [energySource, energyStore] = energySources

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      if (this.shouldWithdrawLink !== true && link != null && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        return RunApiTask.create(TransferEnergyApiWrapper.create(link))
      }
      if (energyStore.store.getFreeCapacity(RESOURCE_ENERGY) < 20000) {
        processLog(this, `Not enough space in ${energyStore} ${roomLink(this.parentRoomName)}`)
        return RunApiTask.create(TransferEnergyApiWrapper.create(energySource))
      }
      return RunApiTask.create(TransferEnergyApiWrapper.create(energyStore))
    }

    if (this.shouldWithdrawLink === true && link != null && link.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      return RunApiTask.create(WithdrawResourceApiWrapper.create(link, RESOURCE_ENERGY))
    }

    // if (link == null || link.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) {
    //   const energyAmount = storage.store.getUsedCapacity(RESOURCE_ENERGY) + terminal.store.getUsedCapacity(RESOURCE_ENERGY)
    //   if (energyAmount > 700000 && energySource instanceof StructureTerminal) {
    //     processLog(this, `Has enough energy ${roomLink(this.parentRoomName)}`)
    //     return null
    //   }
    // }
    // if ((energySource instanceof StructureStorage) && energySource.store.getUsedCapacity(RESOURCE_ENERGY) < 50000) {
    //   processLog(this, `Not enough energy in ${energySource} ${roomLink(this.parentRoomName)}`)
    //   return null
    // }
    return RunApiTask.create(WithdrawResourceApiWrapper.create(energySource, RESOURCE_ENERGY))
  }

  private transferEnergyToLinkTask(creep: Creep, storage: StructureStorage, link: StructureLink): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        return RunApiTask.create(TransferEnergyApiWrapper.create(link))
      }
    }
    return RunApiTask.create(WithdrawResourceApiWrapper.create(storage, RESOURCE_ENERGY))
  }

  private drainStorageTask(creep: Creep, resources: OwnedRoomResource): CreepTask | null {
    if (creep.ticksToLive != null && creep.ticksToLive < 3 && creep.store.getUsedCapacity() <= 0) {
      creep.say("dying")
      return null
    }
    const terminal = resources.activeStructures.terminal
    const storage = resources.activeStructures.storage
    if (terminal == null || storage == null) {
      processLog(this, `No terminal or storage ${roomLink(this.parentRoomName)}`)
      creep.say("no storage")
      return null
    }

    const creepResourceType = Object.keys(creep.store)[0]
    if (creepResourceType != null && isResourceConstant(creepResourceType) && creep.store.getUsedCapacity(creepResourceType) > 0) {
      return RunApiTask.create(TransferResourceApiWrapper.create(terminal, creepResourceType))
    }
    const storageResourceTypes = Object.keys(storage.store) as ResourceConstant[]
    const storageResourceType = storageResourceTypes.sort((lhs, rhs) => {
      if (lhs === RESOURCE_ENERGY) {
        return 1
      }
      if (rhs === RESOURCE_ENERGY) {
        return -1
      }
      return 0
    })[0]
    if (storageResourceType != null && isResourceConstant(storageResourceType) && storage.store.getUsedCapacity(storageResourceType) > 0) {
      return RunApiTask.create(WithdrawResourceApiWrapper.create(storage, storageResourceType))
    }
    processLog(this, `Storage empty ${roomLink(this.parentRoomName)}`)
    creep.say("nth to do")
    return null
  }
}

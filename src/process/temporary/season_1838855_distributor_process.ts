import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
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
import { CommodityConstant, DepositConstant, isResourceConstant } from "utility/resource"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { CreepBody } from "utility/creep_body"
import { GameConstants } from "utility/constants"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("Season1838855DistributorProcess", state => {
  return Season1838855DistributorProcess.decode(state as Season1838855DistributorProcessState)
})

type EnergyStore = StructureTerminal | StructureStorage

export interface Season1838855DistributorProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  linkId: Id<StructureLink> | null
  upgraderLinkId: Id<StructureLink> | null

  drainStorage: boolean
}

// Game.io("launch -l Season1838855DistributorProcess room_name=W51S29 pos=24,21")
export class Season1838855DistributorProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public linkId: Id<StructureLink> | null,
    public upgraderLinkId: Id<StructureLink> | null,
    private drainStorage: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1838855DistributorProcessState {
    return {
      t: "Season1838855DistributorProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      linkId: this.linkId,
      upgraderLinkId: this.upgraderLinkId,
      drainStorage: this.drainStorage,
    }
  }

  public static decode(state: Season1838855DistributorProcessState): Season1838855DistributorProcess {
    return new Season1838855DistributorProcess(state.l, state.i, state.p, state.linkId, state.upgraderLinkId, state.drainStorage ?? false)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName): Season1838855DistributorProcess {
    return new Season1838855DistributorProcess(Game.time, processId, parentRoomName, null, null, false)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public setDrainStorage(): void {
    processLog(this, `${coloredText("[Warning]", "warn")} ${roomLink(this.parentRoomName)} drain storage`)
    this.drainStorage = true
  }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }
    const distributorPosition = resources.roomInfo.roomPlan?.centerPosition
    if (distributorPosition == null) {
      PrimitiveLogger.fatal(`${this.identifier} no room plan ${roomLink(this.parentRoomName)}`)
      return
    }
    const distributorRoomPosition = decodeRoomPosition(distributorPosition, this.parentRoomName)

    if ((Game.time % 263) === 13) {
      this.checkLink(resources)
    }

    const getLink = ((linkId: Id<StructureLink> | null): StructureLink | null => {
      if (linkId == null) {
        return null
      }
      return Game.getObjectById(linkId)
    })
    const link = getLink(this.linkId)
    const upgraderLink = getLink(this.upgraderLinkId)
    if (link != null && upgraderLink != null) {
      this.runLinks(link, upgraderLink)
    }

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (creepCount < 1) {
      if ((resources.controller.level > 4 && resources.activeStructures.storage != null) || resources.activeStructures.terminal != null) {
        const body = ((): BodyPartConstant[] => {
          if (resources.controller.level < 8 || this.drainStorage === true) {
            return CreepBody.create([MOVE], [CARRY], resources.room.energyCapacityAvailable, 8)
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
      () => true,
    )
  }

  private checkLink(resources: OwnedRoomResource): void {
    if (this.linkId == null) {
      const roomPlan = resources.roomInfo.roomPlan
      if (roomPlan != null) {
        try {
          const roomCenter = new RoomPosition(roomPlan.centerPosition.x, roomPlan.centerPosition.y, this.parentRoomName)
          const link = roomCenter.findInRange(FIND_MY_STRUCTURES, 1, { filter: { structureType: STRUCTURE_LINK } })[0] as StructureLink | null
          if (link != null) {
            this.linkId = link.id
          }
        } catch {
          //
        }
      }
    } else {
      if (Game.getObjectById(this.linkId) == null) {
        this.linkId = null
      }
    }
    if (this.upgraderLinkId == null) {
      const upgraderLink = resources.controller.pos.findInRange(FIND_MY_STRUCTURES, 3, { filter: { structureType: STRUCTURE_LINK } })[0] as StructureLink | null
      if (upgraderLink != null) {
        this.upgraderLinkId = upgraderLink.id
      }
    } else {
      if (Game.getObjectById(this.upgraderLinkId) == null) {
        this.upgraderLinkId = null
      }
    }
  }

  private requestDistributor(body: BodyPartConstant[]): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runLinks(link: StructureLink, upgraderLink: StructureLink): void {
    if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      return
    }
    const linkConstants = GameConstants.link
    if (upgraderLink.store.getUsedCapacity(RESOURCE_ENERGY) >= (linkConstants.capaity * linkConstants.loss)) {
      return
    }
    link.transferEnergy(upgraderLink)
  }

  private newDistributorTask(creep: Creep, link: StructureLink | null, resources: OwnedRoomResource, position: RoomPosition): CreepTask | null {
    if (creep.pos.isEqualTo(position) !== true) {
      return MoveToTask.create(position, 0)
    }

    if (this.drainStorage === true) {
      return this.drainStorageTask(creep, resources)
    }

    const storage = resources.activeStructures.storage
    const terminal = resources.activeStructures.terminal
    if (terminal == null && storage != null && link != null) {
      return this.transferEnergyToLinkTask(creep, storage, link)
    }
    if (storage == null || terminal == null) {
      return null
    }

    const canTransferResource = ((): boolean => {
      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        return false
      }
      if (creep.store.getUsedCapacity() > 0) {
        return true
      }
      if (link != null && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        return false
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
      RESOURCE_POWER,
      RESOURCE_OPS,
      ...DepositConstant,
      ...CommodityConstant,
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
      if (link != null && link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        return RunApiTask.create(TransferEnergyApiWrapper.create(link))
      }
      if (energyStore.store.getFreeCapacity(RESOURCE_ENERGY) < 20000) {
        processLog(this, `Not enough space in ${energyStore} ${roomLink(this.parentRoomName)}`)
        return null
      }
      return RunApiTask.create(TransferEnergyApiWrapper.create(energyStore))
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

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { OperatingSystem } from "os/os"
import { processLog } from "process/process_log"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { isResourceConstant } from "utility/resource"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { CreepBody } from "utility/creep_body"

type EnergyStore = StructureTerminal | StructureStorage

export interface Season1838855DistributorProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  position: RoomPositionState
  linkId: Id<StructureLink> | null
  upgraderLinkId: Id<StructureLink> | null
}

// Game.io("launch -l Season1838855DistributorProcess room_name=W6S29 pos=26,36 link_id=610b604e550481c7f76f8e98 upgrader_link_id=610b7ec24645122963c87887")
// Game.io("launch -l Season1838855DistributorProcess room_name=W6S27 pos=14,17 link_id=6116b45395328f410083221f upgrader_link_id=6116bfc03819de00286d3873")
// Game.io("launch -l Season1838855DistributorProcess room_name=W21S23 pos=24,22 link_id=610b564f5504812b426f89ed upgrader_link_id=610b5d807c129561c313bbf2")
// Game.io("launch -l Season1838855DistributorProcess room_name=W3S24 pos=13,14")
// Game.io("launch -l Season1838855DistributorProcess room_name=W9S24 pos=24,32")
// Game.io("launch -l Season1838855DistributorProcess room_name=W14S28 pos=32,29")
// Game.io("launch -l Season1838855DistributorProcess room_name=W24S29 pos=17,9")
// Game.io("launch -l Season1838855DistributorProcess room_name=W27S26 pos=18,13")
// Game.io("launch -l Season1838855DistributorProcess room_name=W29S25 pos=24,9 link_id=6116b1e1c7daf82aff322119 upgrader_link_id=6116b4b1dcb0c172dcfa0449")
export class Season1838855DistributorProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly body: BodyPartConstant[] = [MOVE, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly position: RoomPosition,
    public readonly linkId: Id<StructureLink> | null,
    public readonly upgraderLinkId: Id<StructureLink> | null,
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
      position: this.position.encode(),
      linkId: this.linkId,
      upgraderLinkId: this.upgraderLinkId,
    }
  }

  public static decode(state: Season1838855DistributorProcessState): Season1838855DistributorProcess {
    return new Season1838855DistributorProcess(state.l, state.i, state.p, decodeRoomPosition(state.position), state.linkId, state.upgraderLinkId)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, position: RoomPosition, linkId: Id<StructureLink> | null, upgraderLinkId: Id<StructureLink> | null): Season1838855DistributorProcess {
    return new Season1838855DistributorProcess(Game.time, processId, parentRoomName, position, linkId, upgraderLinkId)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public runOnTick(): void {
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

    const creep = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)[0]
    if (creep == null || (creep.ticksToLive != null && creep.ticksToLive < CreepBody.spawnTime(this.body))) {
      this.requestDistributor()
    }

    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.newDistributorTask(creep, link),
      () => true,
    )
  }

  private requestDistributor(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body: this.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runLinks(link: StructureLink, upgraderLink: StructureLink): void {
    if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      return
    }
    if (upgraderLink.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      return
    }
    link.transferEnergy(upgraderLink)
  }

  private newDistributorTask(creep: Creep, link: StructureLink | null): CreepTask | null {
    if (creep.pos.isEqualTo(this.position) !== true) {
      return MoveToTask.create(this.position, 0)
    }

    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return null
    }

    const storage = resources.activeStructures.storage
    const terminal = resources.activeStructures.terminal
    if (terminal == null && storage != null && link != null) {
      return this.transferEnergyToLinkTask(creep, storage, link)
    }
    if (storage == null || terminal == null) {
      PrimitiveLogger.fatal(`${this.identifier} no active storage or terminal in ${roomLink(this.parentRoomName)}`)
      OperatingSystem.os.suspendProcess(this.processId)
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
    const terminalAmount = 20000
    const excludedResourceTypes: ResourceConstant[] = [
      RESOURCE_ENERGY,
      RESOURCE_POWER,
      RESOURCE_OPS,
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
    const [energySource, energyStore] = ((): [EnergyStore, EnergyStore] => {
      const needEnergy = resources.roomInfo.resourceInsufficiencies[RESOURCE_ENERGY] != null
      if (needEnergy === true) {
        return [terminal, storage]
      } else {
        return [storage, terminal]
      }
    })()

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

    const energyAmount = storage.store.getUsedCapacity(RESOURCE_ENERGY) + terminal.store.getUsedCapacity(RESOURCE_ENERGY)
    if (energyAmount > 700000 && energySource instanceof StructureTerminal) {
      processLog(this, `Has enough energy ${roomLink(this.parentRoomName)}`)
      return null
    }
    if ((energySource instanceof StructureStorage) && energySource.store.getUsedCapacity(RESOURCE_ENERGY) < 50000) {
      processLog(this, `Not enough energy in ${energySource} ${roomLink(this.parentRoomName)}`)
      return null
    }
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

}

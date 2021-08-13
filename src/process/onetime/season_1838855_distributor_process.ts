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

type EnergyStore = StructureTerminal | StructureStorage

export interface Season1838855DistributorProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  position: RoomPositionState
  linkId: Id<StructureLink> | null
  upgraderLinkId: Id<StructureLink> | null
}

// Game.io("launch -l Season1838855DistributorProcess room_name= pos= link_id= upgrader_link_id=")
// Game.io("launch -l Season1838855DistributorProcess room_name=W6S29 pos=26,36 link_id=610b604e550481c7f76f8e98 upgrader_link_id=610b7ec24645122963c87887")
export class Season1838855DistributorProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

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

    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    if (creepCount < 1) {
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
      body: [MOVE, CARRY, CARRY, CARRY, CARRY],
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
    if (storage == null || terminal == null) {
      PrimitiveLogger.fatal(`${this.identifier} no active storage or terminal in ${roomLink(this.parentRoomName)}`)
      OperatingSystem.os.suspendProcess(this.processId)
      return null
    }

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
      if (energyStore.store.getFreeCapacity(RESOURCE_ENERGY) < 10000) {
        processLog(this, `Not enough space in ${energyStore} ${roomLink(this.parentRoomName)}`)
        return null
      }
      return RunApiTask.create(TransferEnergyApiWrapper.create(energyStore))
    }
    if (energySource.store.getUsedCapacity(RESOURCE_ENERGY) < 50000) {
      processLog(this, `Not enough energy in ${energySource} ${roomLink(this.parentRoomName)}`)
      return null
    }
    return RunApiTask.create(WithdrawResourceApiWrapper.create(energySource, RESOURCE_ENERGY))
  }
}

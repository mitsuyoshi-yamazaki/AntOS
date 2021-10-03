import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "os/infrastructure/logger"
import { OperatingSystem } from "os/os"
import { Season1838855DistributorProcess } from "./season_1838855_distributor_process"
import { RoomResources } from "room_resource/room_resources"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("Season2055924SendResourcesProcess", state => {
  return Season2055924SendResourcesProcess.decode(state as Season2055924SendResourcesProcessState)
})

export interface Season2055924SendResourcesProcessState extends ProcessState {
  /** parent room name */
  p: RoomName
}

// Game.io("launch -l Season2055924SendResourcesProcess room_name=W55S9")
export class Season2055924SendResourcesProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season2055924SendResourcesProcessState {
    return {
      t: "Season2055924SendResourcesProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
    }
  }

  public static decode(state: Season2055924SendResourcesProcessState): Season2055924SendResourcesProcess {
    return new Season2055924SendResourcesProcess(state.l, state.i, state.p)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName): Season2055924SendResourcesProcess {
    const distributorProcess = OperatingSystem.os.listAllProcesses()
      .map(processInfo => processInfo.process)
      .find(process => {
        if (!(process instanceof Season1838855DistributorProcess)) {
          return false
        }
        return process.parentRoomName === parentRoomName
      }) as Season1838855DistributorProcess | null
    if (distributorProcess != null) {
      distributorProcess.setDrainStorage()
      PrimitiveLogger.log(`Drain storage ${roomLink(parentRoomName)}`)
    } else {
      PrimitiveLogger.fatal(`No distributor process found for ${roomLink(parentRoomName)}`)
    }
    return new Season2055924SendResourcesProcess(Game.time, processId, parentRoomName)
  }

  public processShortDescription(): string {
    return `${roomLink(this.parentRoomName)}`
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    const terminal = objects.activeStructures.terminal
    if (terminal == null) {
      processLog(this, `No terminal in ${roomLink(this.parentRoomName)} suspending...`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    if (terminal.cooldown > 0) {
      return
    }
    if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < 1000) {
      processLog(this, `No energy in terminal ${roomLink(this.parentRoomName)}`)
      return
    }

    const sendResourceType = this.sendResourceType(terminal, objects.activeStructures.storage)
    if (sendResourceType == null) {
      return
    }
    this.sendResource(sendResourceType, terminal)
  }

  private sendResource(resourceType: ResourceConstant, terminal: StructureTerminal): void {
    const resourceAmount = terminal.store.getUsedCapacity(resourceType)
    if (resourceAmount <= 0) {
      PrimitiveLogger.programError(`${this.identifier} no ${coloredResourceType(resourceType)} in ${terminal} ${roomLink(this.parentRoomName)}`)
      return
    }
    const destinationRoomName = this.findDestinationFor(resourceType, resourceAmount)
    if (destinationRoomName == null) {
      processLog(this, `${coloredText("[Warning]", "warn")} No room to send ${coloredResourceType(resourceType)} from ${roomLink(this.parentRoomName)}`)
      return
    }
    const result = terminal.send(resourceType, resourceAmount, destinationRoomName)
    switch (result) {
    case OK:
      processLog(this, `${coloredText("[Info]", "info")} ${resourceAmount} ${coloredResourceType(resourceType)} sent from ${roomLink(this.parentRoomName)} to ${roomLink(destinationRoomName)}`)
      break

    case ERR_NOT_ENOUGH_RESOURCES:
      break

    case ERR_NOT_OWNER:
    case ERR_INVALID_ARGS:
    case ERR_TIRED:
      PrimitiveLogger.programError(`${this.identifier} terminal.send() returns ${result} ${roomLink(this.parentRoomName)}`)
      break
    }
  }

  private sendResourceType(terminal: StructureTerminal, storage: StructureStorage | null): ResourceConstant | null {
    const resourceTypes = Object.keys(terminal.store) as ResourceConstant[]
    if (storage == null || terminal.store.getFreeCapacity() < 10000) {
      return resourceTypes.sort((lhs, rhs) => {
        if (lhs === RESOURCE_ENERGY) {
          return 1
        }
        if (rhs === RESOURCE_ENERGY) {
          return -1
        }
        return terminal.store.getUsedCapacity(rhs) - terminal.store.getUsedCapacity(lhs)
      })[0] ?? null
    }

    const resourceType = resourceTypes.sort((lhs, rhs) => {
      if (lhs === RESOURCE_ENERGY) {
        return 1
      }
      if (rhs === RESOURCE_ENERGY) {
        return -1
      }
      const storageAmountL = storage.store.getUsedCapacity(lhs)
      const storageAmountR = storage.store.getUsedCapacity(rhs)
      if (storageAmountL !== storageAmountR) {
        return storageAmountL - storageAmountR
      }
      return terminal.store.getUsedCapacity(rhs) - terminal.store.getUsedCapacity(lhs)
    })[0] ?? null

    if (resourceType == null) {
      return null
    }
    const terminalResourceLimitAmount = 20000
    if (storage.store.getUsedCapacity(resourceType) > 0 && terminal.store.getUsedCapacity(resourceType) < terminalResourceLimitAmount) {
      return null
    }
    return resourceType
  }

  private findDestinationFor(resourceType: ResourceConstant, amount: number): RoomName | null {
    const targetTerminals = [...RoomResources.getOwnedRoomResources()]
      .flatMap(roomResource => {
        if (roomResource.room.name === this.parentRoomName) {
          return []
        }
        const targetTerminal = roomResource.activeStructures.terminal
        if (targetTerminal == null) {
          return []
        }
        if ((targetTerminal.store.getFreeCapacity() - amount) < 20000) {
          return []
        }
        return targetTerminal
      })
      .sort((lhs, rhs) => {
        return Game.map.getRoomLinearDistance(lhs.room.name, this.parentRoomName) - Game.map.getRoomLinearDistance(rhs.room.name, this.parentRoomName)
      })

    for (const targetTerminal of targetTerminals) {
      if (targetTerminal.store.getUsedCapacity(resourceType) > 0) {
        return targetTerminal.room.name
      }
    }

    return targetTerminals[0]?.room.name ?? null
  }
}

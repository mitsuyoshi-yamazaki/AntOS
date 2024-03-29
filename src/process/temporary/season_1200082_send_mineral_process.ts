import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { World } from "world_info/world_info"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import type { RoomName } from "shared/utility/room_name_types"
import { processLog } from "os/infrastructure/logger"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("Season1200082SendMineralProcess", state => {
  return Season1200082SendMineralProcess.decode(state as Season1200082SendMineralProcessState)
})

export interface Season1200082SendMineralProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName
}

export class Season1200082SendMineralProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
  }

  public encode(): Season1200082SendMineralProcessState {
    return {
      t: "Season1200082SendMineralProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
    }
  }

  public static decode(state: Season1200082SendMineralProcessState): Season1200082SendMineralProcess {
    return new Season1200082SendMineralProcess(state.l, state.i, state.p, state.tr)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName): Season1200082SendMineralProcess {
    return new Season1200082SendMineralProcess(Game.time, processId, parentRoomName, targetRoomName)
  }

  public processShortDescription(): string {
    return roomLink(this.parentRoomName)
  }

  public runOnTick(): void {
    const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
    if (objects == null) {
      PrimitiveLogger.fatal(`${this.identifier} ${roomLink(this.parentRoomName)} lost`)
      return
    }

    const terminal = objects.activeStructures.terminal
    if (terminal == null) {
      processLog(this, `No terminal ${roomLink(this.parentRoomName)}`)
      return
    }

    if (terminal.cooldown > 0) {
      return
    }

    const targetRoomObjects = World.rooms.getOwnedRoomObjects(this.targetRoomName)
    if (targetRoomObjects == null || targetRoomObjects.activeStructures.terminal == null || targetRoomObjects.activeStructures.terminal.store.getFreeCapacity() < 20000) {
      processLog(this, `${coloredText("[Warning]", "warn")} No destination terminal in ${roomLink(this.targetRoomName)}`)
      return
    }

    const resourceTypes = Object.keys(terminal.store) as ResourceConstant[]
    const resourceInfo = ((): { resource: ResourceConstant, amount: number } | null => {
      for (const resourceType of resourceTypes) {
        if (resourceType === RESOURCE_ENERGY) {
          continue
        }
        const amount = terminal.store.getUsedCapacity(resourceType)
        if (amount > 50) {
          return {resource: resourceType, amount}
        }
      }
      return null
    })()
    if (resourceInfo == null) {
      return
    }

    const result = terminal.send(resourceInfo.resource, resourceInfo.amount, this.targetRoomName)
    switch (result) {
    case OK:
      processLog(this, `${coloredResourceType(resourceInfo.resource)} sent ${roomLink(this.parentRoomName)} to ${roomLink(this.targetRoomName)}`)
      break

    case ERR_NOT_OWNER:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_INVALID_ARGS:
    case ERR_TIRED:
      processLog(this, `${coloredText("[ERROR]", "error")} ${result} ${coloredResourceType(resourceInfo.resource)}, ${roomLink(this.parentRoomName)} to ${this.targetRoomName}`)
      break
    }
  }
}

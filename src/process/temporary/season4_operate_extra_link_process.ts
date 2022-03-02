import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomName } from "utility/room_name"
import { RoomResources } from "room_resource/room_resources"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("Season4OperateExtraLinkProcess", state => {
  return Season4OperateExtraLinkProcess.decode(state as Season4OperateExtraLinkProcessState)
})

export interface Season4OperateExtraLinkProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly upgraderLinkId: Id<StructureLink>
}

export class Season4OperateExtraLinkProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly upgraderLinkId: Id<StructureLink>,
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
  }

  public encode(): Season4OperateExtraLinkProcessState {
    return {
      t: "Season4OperateExtraLinkProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      upgraderLinkId: this.upgraderLinkId,
    }
  }

  public static decode(state: Season4OperateExtraLinkProcessState): Season4OperateExtraLinkProcess {
    return new Season4OperateExtraLinkProcess(state.l, state.i, state.roomName, state.upgraderLinkId)
  }

  public static create(processId: ProcessId, roomName: RoomName, upgraderLinkId: Id<StructureLink>): Season4OperateExtraLinkProcess {
    return new Season4OperateExtraLinkProcess(Game.time, processId, roomName, upgraderLinkId)
  }

  public processShortDescription(): string {
    const extraLinks = RoomResources.getOwnedRoomResource(this.roomName)?.roomInfo.config?.extraLinkIds?.length ?? 0
    return `${roomLink(this.roomName)} ${extraLinks} extra links`
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const fullLinks = ((): StructureLink[] => {
      if (roomResource.roomInfo.config?.extraLinkIds == null) {
        return []
      }
      return roomResource.roomInfo.config.extraLinkIds.flatMap(linkId => {
        const link = Game.getObjectById(linkId)
        if (link == null) {
          return []
        }
        if (link.cooldown > 0) {
          return []
        }
        if (link.store.getFreeCapacity(RESOURCE_ENERGY) > 100) {
          return []
        }
        return [link]
      })
    })()

    const link = fullLinks[0]
    if (link == null) {
      return
    }

    const upgraderLink = Game.getObjectById(this.upgraderLinkId)
    if (upgraderLink == null) {
      return
    }
    if (upgraderLink.store.getUsedCapacity(RESOURCE_ENERGY) > (upgraderLink.store.getCapacity(RESOURCE_ENERGY) * 0.1)) {
      return
    }

    this.operateLink(link, upgraderLink)
  }

  private operateLink(link: StructureLink, upgraderLink: StructureLink): void {
    link.transferEnergy(upgraderLink)
  }
}

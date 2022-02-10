import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomName } from "utility/room_name"
import { RoomResources } from "room_resource/room_resources"
import { ProcessDecoder } from "process/process_decoder"
import { ResourceManager } from "utility/resource_manager"

ProcessDecoder.register("World39013108CollectResourceProcess", state => {
  return World39013108CollectResourceProcess.decode(state as World39013108CollectResourceProcessState)
})

export interface World39013108CollectResourceProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly resourceType: ResourceConstant
  readonly amount: number
  readonly interval: number
}

export class World39013108CollectResourceProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly resourceType: ResourceConstant,
    private readonly amount: number,
    private readonly interval: number,
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.resourceType}`
  }

  public encode(): World39013108CollectResourceProcessState {
    return {
      t: "World39013108CollectResourceProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      resourceType: this.resourceType,
      amount: this.amount,
      interval: this.interval,
    }
  }

  public static decode(state: World39013108CollectResourceProcessState): World39013108CollectResourceProcess {
    return new World39013108CollectResourceProcess(state.l, state.i, state.roomName, state.resourceType, state.amount, state.interval)
  }

  public static create(processId: ProcessId, roomName: RoomName, resourceType: ResourceConstant, amount: number, interval: number): World39013108CollectResourceProcess {
    return new World39013108CollectResourceProcess(Game.time, processId, roomName, resourceType, amount, interval)
  }

  public processShortDescription(): string {
    return `collect ${this.amount} ${coloredResourceType(this.resourceType)} to ${roomLink(this.roomName)}`
  }

  public runOnTick(): void {
    if ((Game.time % this.interval) !== 0) {
      return
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null || roomResource.activeStructures.terminal == null) {
      return
    }

    const terminal = roomResource.activeStructures.terminal
    const resourceAmount = roomResource.getResourceAmount(this.resourceType)
    if (resourceAmount > this.amount) {
      return
    }

    const collectAmount = Math.max(this.amount - resourceAmount, Math.floor(this.amount / 2))
    if ((terminal.store.getFreeCapacity(this.resourceType) - collectAmount) < 10000) {
      return
    }

    ResourceManager.collect(this.resourceType, this.roomName, collectAmount)
  }
}

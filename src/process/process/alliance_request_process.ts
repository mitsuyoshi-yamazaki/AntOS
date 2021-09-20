import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("AllianceRequestProcess", state => {
  return AllianceRequestProcess.decode(state as AllianceRequestProcessState)
})

export interface AllianceRequestProcessState extends ProcessState {
  /** parent room name */
  readonly p: RoomName

  readonly resourceType: ResourceConstant
  readonly amount: number
}

export class AllianceRequestProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly resourceType: ResourceConstant,
    private amount: number,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): AllianceRequestProcessState {
    return {
      t: "AllianceRequestProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      resourceType: this.resourceType,
      amount: this.amount,
    }
  }

  public static decode(state: AllianceRequestProcessState): AllianceRequestProcess {
    return new AllianceRequestProcess(state.l, state.i, state.p, state.resourceType, state.amount)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, resourceType: ResourceConstant, amount: number): AllianceRequestProcess {
    return new AllianceRequestProcess(Game.time, processId, parentRoomName, resourceType, amount)
  }

  // TODO:
  // public processShortDescription(): string {
  //   const creep = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)[0]
  //   const currentLocation = creep != null ? `${roomLink(creep.room.name)}` : "none"
  //   return `from: ${roomLink(this.parentRoomName)}, current: ${currentLocation}`
  // }

  public runOnTick(): void {
    const resources = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${roomLink(this.parentRoomName)} lost`)
      return
    }

    // TODO:
  }
}

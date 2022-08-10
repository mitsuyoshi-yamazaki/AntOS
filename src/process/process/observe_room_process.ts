import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { processLog } from "os/infrastructure/logger"
import { RoomName } from "utility/room_name"
import { Timestamp } from "utility/timestamp"
import { OperatingSystem } from "os/os"
import { RoomResources } from "room_resource/room_resources"
import { ProcessDecoder } from "process/process_decoder"

ProcessDecoder.register("ObserveRoomProcess", state => {
  return ObserveRoomProcess.decode(state as ObserveRoomProcessState)
})

export interface ObserveRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly until: Timestamp
}

export class ObserveRoomProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly until: Timestamp,
  ) {
    this.taskIdentifier = this.constructor.name
  }

  public encode(): ObserveRoomProcessState {
    return {
      t: "ObserveRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      until: this.until,
    }
  }

  public static decode(state: ObserveRoomProcessState): ObserveRoomProcess {
    return new ObserveRoomProcess(state.l, state.i, state.roomName, state.targetRoomName, state.until)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, duration: Timestamp): ObserveRoomProcess {
    PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} ObserveRoomProcess only `)
    return new ObserveRoomProcess(Game.time, processId, roomName, targetRoomName, Game.time + duration)
  }

  public processShortDescription(): string {
    return `${roomLink(this.targetRoomName)} in ${this.until - Game.time} ticks`
  }

  public runOnTick(): void {
    if (this.until < Game.time) {
      processLog(this, `${coloredText("Finished", "warn")}`)
      OperatingSystem.os.killProcess(this.processId)
      return
    }
    const resources = RoomResources.getOwnedRoomResource(this.roomName)
    if (resources == null) {
      PrimitiveLogger.fatal(`${roomLink(this.roomName)} lost`)
      return
    }
    if (resources.activeStructures.observer != null) {
      resources.activeStructures.observer.observeRoom(this.targetRoomName)
      return
    }

    // TODO:
  }
}

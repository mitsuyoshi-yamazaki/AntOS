import { MessageObserver } from "os/infrastructure/message_observer"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { RoomName } from "utility/room_name"
import { } from "./construction_saboteur_process"

ProcessDecoder.register("DraftingRoomProcess", state => {
  return DraftingRoomProcess.decode(state as DraftingRoomProcessState)
})

interface DraftingRoomProcessState extends ProcessState {
  readonly baseRoomNames: RoomName[]
}

export class DraftingRoomProcess implements Process, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly baseRoomNames: RoomName[]
  ) {
    this.identifier = `${this.constructor.name}`
  }

  public encode(): DraftingRoomProcessState {
    return {
      t: "DraftingRoomProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: DraftingRoomProcessState): DraftingRoomProcess {
    return new DraftingRoomProcess(state.l, state.i, state.targetRoomInfo)
  }

  public static create(processId: ProcessId, targetRoomName: RoomName): DraftingRoomProcess {
    const targetRoomInfo: TargetRoomInfo = {
      roomName: targetRoomName,
      safemodeEndsAt: null,
    }
    return new DraftingRoomProcess(Game.time, processId, targetRoomInfo)
  }

  public didReceiveMessage(message: string): string {
    const components = message.split(" ")
    const command = components[0]
    switch (command) {
      case helpCommand:
        return `Commands: ${commands}`
      default:
        return `Invalid command ${command}. "help" to show command list`
    }
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomInfo.roomName]
    if (targetRoom != null) {

      this.targetRoomInfo.safemodeEndsAt
    }
  }
}

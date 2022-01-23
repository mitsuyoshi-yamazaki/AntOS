import { MessageObserver } from "os/infrastructure/message_observer"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { RoomName } from "utility/room_name"
import { } from "./construction_saboteur_process"

ProcessDecoder.register("AttackRoomProcess", state => {
  return AttackRoomProcess.decode(state as AttackRoomProcessState)
})

const helpCommand = "help"

const commands = [
  helpCommand,
]

type TargetRoomInfo = {
  roomName: RoomName
  safemodeEndsAt: number | null
}

type ChildProcessInfo = {

}

interface AttackRoomProcessState extends ProcessState {
  readonly targetRoomInfo: TargetRoomInfo
}

export class AttackRoomProcess implements Process, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly targetRoomInfo: TargetRoomInfo,
  ) {
    this.identifier = `${this.constructor.name}`
  }

  public encode(): AttackRoomProcessState {
    return {
      t: "AttackRoomProcess",
      l: this.launchTime,
      i: this.processId,
      targetRoomInfo: this.targetRoomInfo,
    }
  }

  public static decode(state: AttackRoomProcessState): AttackRoomProcess {
    return new AttackRoomProcess(state.l, state.i, state.targetRoomInfo)
  }

  public static create(processId: ProcessId, targetRoomName: RoomName): AttackRoomProcess {
    const targetRoomInfo: TargetRoomInfo = {
      roomName: targetRoomName,
      safemodeEndsAt: null,
    }
    return new AttackRoomProcess(Game.time, processId, targetRoomInfo)
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

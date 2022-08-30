import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "shared/utility/room_name"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { UniqueId } from "utility/unique_id"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { } from "./saboteur_tower"

ProcessDecoder.register("ActiveSaboteurProcess", state => {
  return ActiveSaboteurProcess.decode(state as ActiveSaboteurProcessState)
})

export interface ActiveSaboteurProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly stopSpawningReasons: string[]
}

export class ActiveSaboteurProcess implements Process, Procedural, MessageObserver {
  public taskIdentifier: string

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly stopSpawningReasons: string[],
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.processId}_${this.roomName}_${this.targetRoomName}`
    this.codename = UniqueId.generateCodename(this.taskIdentifier, this.launchTime)
  }

  public encode(): ActiveSaboteurProcessState {
    return {
      t: "ActiveSaboteurProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      stopSpawningReasons: this.stopSpawningReasons,
    }
  }

  public static decode(state: ActiveSaboteurProcessState): ActiveSaboteurProcess {
    return new ActiveSaboteurProcess(
      state.l,
      state.i,
      state.roomName,
      state.targetRoomName,
      state.stopSpawningReasons,
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): ActiveSaboteurProcess {
    return new ActiveSaboteurProcess(
      Game.time,
      processId,
      roomName,
      targetRoomName,
      [],
    )
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.targetRoomName)
    ]
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status"]

    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "status":
        throw "not implemented yet"

      default:
        return `Invalid command ${command}. "help" to show command list`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
  }
}

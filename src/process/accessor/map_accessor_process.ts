import { GameMap } from "game/game_map"
import { MessageObserver } from "os/infrastructure/message_observer"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"

ProcessDecoder.register("MapAccessorProcess", state => {
  return MapAccessorProcess.decode(state as MapAccessorProcessState)
})

const helpCommand = "help"
const showCommand = "show"

const commands = [
  helpCommand,
  showCommand,
]

interface MapAccessorProcessState extends ProcessState {
}

export class MapAccessorProcess implements Process, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
  ) {
    this.identifier = `${this.constructor.name}`
  }

  public encode(): MapAccessorProcessState {
    return {
      t: "MapAccessorProcess",
      l: this.launchTime,
      i: this.processId,
    }
  }

  public static decode(state: MapAccessorProcessState): MapAccessorProcess {
    return new MapAccessorProcess(state.l, state.i)
  }

  public static create(processId: ProcessId): MapAccessorProcess {
    return new MapAccessorProcess(Game.time, processId)
  }

  public didReceiveMessage(message: string): string {
    const components = message.split(" ")
    const command = components[0]
    switch (command) {
    case helpCommand:
      return `Commands: ${commands}`

    case showCommand: {
      const manual = "show &ltroom_name&gt &ltdestination_room_name&gt"
      const roomName = components[1]
      if (roomName == null) {
        return `Roomname not specified. ${manual}`
      }
      const destinationRoomName = components[2]
      if (destinationRoomName == null) {
        return `Destination Roomname not specified. ${manual}`
      }
      const waypoints = GameMap.getWaypoints(roomName, destinationRoomName)
      if (waypoints == null) {
        return `Waypoints not set ${roomLink(roomName)} -> ${roomLink(destinationRoomName)}`
      }
      return `${roomLink(roomName)} -> ${waypoints.map(name => roomLink(name))} -> ${roomLink(destinationRoomName)}`
    }
    default:
      return `Invalid command ${command}. "help" to show command list`
    }
  }

  public runOnTick(): void {
    // do nothing
  }
}

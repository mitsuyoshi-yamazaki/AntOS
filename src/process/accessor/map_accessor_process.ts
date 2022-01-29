import { GameMap } from "game/game_map"
import { MessageObserver } from "os/infrastructure/message_observer"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { coloredText, roomLink } from "utility/log"
import { RoomName } from "utility/room_name"
import { ProcessState } from "../process_state"

ProcessDecoder.register("MapAccessorProcess", state => {
  return MapAccessorProcess.decode(state as MapAccessorProcessState)
})

const helpCommand = "help"
const showCommand = "show"
const setCommand = "set"

const commands = [
  helpCommand,
  showCommand,
  setCommand,
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
    case showCommand:
      return this.showWaypoints(components)
    case setCommand:
      return this.setWaypoints(components)
    default:
      return `Invalid command ${command}. "help" to show command list`
    }
  }

  public runOnTick(): void {
    // do nothing
  }

  private showWaypoints(commandComponents: string[]): string {
    const manual = "show &ltroom_name&gt &ltdestination_room_name&gt"
    const roomName = commandComponents[1]
    if (roomName == null) {
      return `room_name not specified. ${manual}`
    }
    const destinationRoomName = commandComponents[2]
    if (destinationRoomName == null) {
      return `destination_room_name not specified. ${manual}`
    }
    const waypoints = GameMap.getWaypoints(roomName, destinationRoomName)
    if (waypoints == null) {
      return `waypoints not set ${roomLink(roomName)} -> ${roomLink(destinationRoomName)}`
    }
    if (waypoints.length <= 0) {
      return `${roomLink(roomName)} -> ${roomLink(destinationRoomName)}`
    }
    return `${roomLink(roomName)} -> ${waypoints.map(name => roomLink(name))} -> ${roomLink(destinationRoomName)}`
  }

  private setWaypoints(commandComponents: string[]): string {
    try {
      const manual = "set &ltroom_name&gt &ltdestination_room_name&gt &ltwaypoint1,waypoint2,...&gt"
      const roomName = commandComponents[1]
      if (roomName == null) {
        throw `room_name not specified. ${manual}`
      }
      if (this.isValidRoomName(roomName) !== true) {
        throw `room_name ${roomName} is not valid`
      }
      const destinationRoomName = commandComponents[2]
      if (destinationRoomName == null) {
        throw `destination_room_name not specified. ${manual}`
      }
      if (this.isValidRoomName(destinationRoomName) !== true) {
        throw `destination_room_name ${destinationRoomName} is not valid`
      }
      const waypoints = ((): RoomName[] => {
        const rawWaypoints = commandComponents[3]
        if (rawWaypoints == null) {
          return []
        }
        return rawWaypoints.split(",")
      })()
      const invalidWaypoints = waypoints.filter(name => this.isValidRoomName(name) !== true)
      if (invalidWaypoints.length > 0) {
        throw `waypoints ${invalidWaypoints.join(",")} are not valid`
      }
      GameMap.setWaypoints(roomName, destinationRoomName, waypoints)

      const waypointDescription = waypoints.length <= 0 ? "no waypoints" : waypoints.map(name => roomLink(name)).join(",")
      return `${roomLink(roomName)} -> ${waypointDescription} -> ${roomLink(destinationRoomName)}`
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  private isValidRoomName(roomName: RoomName): boolean {
    const roomStatus = Game.map.getRoomStatus(roomName)
    if (roomStatus == null) { // フォーマットが間違っているとundefinedが返る
      return false
    }
    if (roomStatus.status === "closed") {
      return false
    }
    return true
  }
}

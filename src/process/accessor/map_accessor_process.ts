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
const showMissingWaypoints = "show_missing_waypoints"

const commands = [
  helpCommand,
  showCommand,
  setCommand,
  showMissingWaypoints,
]

interface MapAccessorProcessState extends ProcessState {
  readonly missingWaypoints: { from: RoomName, to: RoomName }[]
}

export class MapAccessorProcess implements Process, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private missingWaypointIdentifiers: string[]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private missingWaypoints: { from: RoomName, to: RoomName }[],
  ) {
    this.identifier = `${this.constructor.name}`

    this.missingWaypointIdentifiers = missingWaypoints.map(waypoint => this.waypointIdentifier(waypoint.from, waypoint.to))
  }

  public encode(): MapAccessorProcessState {
    return {
      t: "MapAccessorProcess",
      l: this.launchTime,
      i: this.processId,
      missingWaypoints: this.missingWaypoints,
    }
  }

  public static decode(state: MapAccessorProcessState): MapAccessorProcess {
    const missingWaypoints = state.missingWaypoints ?? [] // Migration
    return new MapAccessorProcess(state.l, state.i, missingWaypoints)
  }

  public static create(processId: ProcessId): MapAccessorProcess {
    return new MapAccessorProcess(Game.time, processId, [])
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
    case showMissingWaypoints:
      return this.showMissingWaypoints()
    default:
      return `Invalid command ${command}. "help" to show command list`
    }
  }

  public runOnTick(): void {
    const missingWaypoints = GameMap.clearMissingWaypoints()
    missingWaypoints.forEach(waypoint => {
      const waypointIdentifier = this.waypointIdentifier(waypoint.from, waypoint.to)
      if (this.missingWaypointIdentifiers.includes(waypointIdentifier) === true) {
        return
      }
      const returnTripIdentifier = this.waypointIdentifier(waypoint.to, waypoint.from)
      if (this.missingWaypointIdentifiers.includes(returnTripIdentifier) === true) {
        return
      }

      this.missingWaypointIdentifiers.push(waypointIdentifier)
      this.missingWaypoints.push(waypoint)
    })
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
    const waypoints = GameMap.getWaypoints(roomName, destinationRoomName, {ignoreMissingWaypoints: true})
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

  private showMissingWaypoints(): string {
    this.refreshMissingWaypoints()

    const descriptions: string[] = [
      "Missing waypoints:",
      ...this.missingWaypoints.map(pair => `${roomLink(pair.from)}=&gt${roomLink(pair.to)}`),
    ]

    return descriptions.join("\n")
  }

  private refreshMissingWaypoints(): void {
    this.missingWaypoints = this.missingWaypoints.filter(waypoint => {
      if (GameMap.getWaypoints(waypoint.from, waypoint.to, {ignoreMissingWaypoints: true}) != null) {
        return false
      }
      return true
    })
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

  private waypointIdentifier(from: RoomName, to: RoomName): string {
    return `${from}=>${to}`
  }
}

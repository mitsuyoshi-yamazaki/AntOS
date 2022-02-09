import { GameMap } from "game/game_map"
import { KeywordArguments } from "os/infrastructure/console_command/utility/keyword_argument_parser"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"
import { MessageObserver } from "os/infrastructure/message_observer"
import { Process, ProcessId } from "process/process"
import { ProcessDecoder } from "process/process_decoder"
import { coloredText, roomLink } from "utility/log"
import { RoomCoordinate, RoomName } from "utility/room_name"
import { RoomSector } from "utility/room_sector"
import { ProcessState } from "../process_state"

ProcessDecoder.register("MapAccessorProcess", state => {
  return MapAccessorProcess.decode(state as MapAccessorProcessState)
})

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
    const commandList = ["help", "show", "set", "show_missing_waypoints", "set_highway_waypoints"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "show":
        return this.showWaypoints(components)
      case "set":
        return this.setWaypoints(components)
      case "show_missing_waypoints":
        return this.showMissingWaypoints()
      case "set_highway_waypoints":
        return this.setHighwayWaypoints(components)
      default:
        throw `Invalid command ${command}. "help" to show command list`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
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

  /** @throws */
  private setHighwayWaypoints(args: string[]): string {
    const listArguments = new ListArguments(args)
    const keywordArguments = new KeywordArguments(args)
    const roomCoordinate = listArguments.roomCoordinate(0, "room name").parse()
    const roomName = roomCoordinate.roomName
    const dryRun = keywordArguments.boolean("dry_run").parseOptional() ?? true

    const results: string[] = []
    if (dryRun === true) {
      results.push("dry_run")
    }

    const addRoute = (destinationRoomName: RoomName, highwayEntranceRoomName: RoomName): void => {
      const hasWaypoints = GameMap.getWaypoints(roomName, destinationRoomName, { ignoreMissingWaypoints: true }) != null
      if (hasWaypoints === true) {
        results.push(`${roomLink(roomName)} to ${roomLink(destinationRoomName)} has waypoints`)
        return
      }
      const hasWaypointsToEntrance = GameMap.getWaypoints(roomName, highwayEntranceRoomName, { ignoreMissingWaypoints: true }) != null
      if (hasWaypointsToEntrance !== true) {
        results.push(`no waypoints from ${roomLink(roomName)} to highway entrance ${highwayEntranceRoomName}`)
        return
      }
      if (dryRun !== true) {
        GameMap.setWaypoints(roomName, destinationRoomName, [highwayEntranceRoomName])
      }
      results.push(`${coloredText("[Set]", "info")} ${roomLink(roomName)} =&gt ${roomLink(highwayEntranceRoomName)} =&gt ${roomLink(destinationRoomName)}`)
    }

    const calculateFromHighwayEntrance = (highwayEntranceRoomName: RoomName): void => {
      const hasWaypoint = GameMap.getWaypoints(roomName, highwayEntranceRoomName, { ignoreMissingWaypoints: true }) != null
      if (hasWaypoint !== true) {
        results.push(`no direct route to ${roomLink(highwayEntranceRoomName)}`)
        return
      }
      const highwayEntranceRoomCoordinate = RoomCoordinate.parse(highwayEntranceRoomName)
      if (highwayEntranceRoomCoordinate == null) {
        throw `failed to parse RoomCoordinate ${roomLink(highwayEntranceRoomName)}`
      }
      const detailedCoordinate = highwayEntranceRoomCoordinate.detailedCoordinate()
      if (detailedCoordinate.case !== "highway") {
        throw `${roomLink(highwayEntranceRoomName)} is not highway entrance`
      }

      const highway = detailedCoordinate.highway
      const highwayOriginRoomCoordinate = highwayEntranceRoomCoordinate

      const highwayRooms = ((): RoomName[] => {
        const roomCount = 5
        const indexArray: number[] = [
          ...Array(roomCount).fill(0).map((x, index) => -(index + 1)),
          ...Array(roomCount).fill(0).map((x, index) => index + 1),
        ]
        switch (highway.direction) {
        case "horizontal":
          return indexArray.map(index => highwayOriginRoomCoordinate.getRoomCoordinateTo(index, 0).roomName)
        case "vertical":
          return indexArray.map(index => highwayOriginRoomCoordinate.getRoomCoordinateTo(0, index).roomName)
        }
      })()

      highwayRooms.forEach(highwayRoom => {
        addRoute(highwayRoom, highwayEntranceRoomName)
      })
    }

    const givenHighwayEntranceRoomName = keywordArguments.roomName("highway_entrance_room_name").parseOptional()
    if (givenHighwayEntranceRoomName != null) {
      calculateFromHighwayEntrance(givenHighwayEntranceRoomName)
      return results.join("\n")
    }

    const sector = new RoomSector(roomCoordinate)
    const routes = sector.getNearestHighwayRoutes(roomName)
    if (routes.length <= 0) {
      throw `failed to find routes to highway for ${roomLink(roomName)}`
    }

    routes.forEach(route => {
      const highwayEntranceRoomName = route[route.length - 1]
      if (highwayEntranceRoomName == null) {
        results.push("route length is 0")
        return
      }
      calculateFromHighwayEntrance(highwayEntranceRoomName)
    })

    return results.join("\n")
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

import { ListArguments } from "../../../../shared/utility/argument_parser/list_argument_parser"
import { roomLink } from "utility/log"
import { RoomSector } from "utility/room_sector"
import { RoomCoordinate } from "utility/room_coordinate"

/** @throws */
export function execRoomPathfindingCommand(args: string[]): string {
  const commandList = ["help", "show_closest_highway"]
  const listArguments = new ListArguments(args)
  const command = listArguments.string(0, "command").parse()
  args.shift()

  switch (command) {
  case "help":
    return `Commands: ${commandList}`
  case "show_closest_highway":
    return showClosestHighway(args)
  default:
    throw `Invalid command ${command}. see "help"`
  }
}

/** @throws */
function showClosestHighway(args: string[]): string {
  const listArguments = new ListArguments(args)
  const originRoomName = listArguments.roomName(0, "room name").parse({ allowClosedRoom: true })
  const roomCoordinate = RoomCoordinate.parse(originRoomName)
  if (roomCoordinate == null) {
    throw `failed to parse ${roomLink(originRoomName)}`
  }
  const sector = new RoomSector(roomCoordinate)
  const routes = sector.getNearestHighwayRoutes(originRoomName)

  const routeDescriptions: string[] = routes.map(route => {
    const pathSteps: string[] = [
      roomLink(originRoomName),
      ...route.map(roomName => roomLink(roomName)),
    ]
    const highwayDescription = ((): string => {
      const highwayRoomName = route[route.length - 1]
      if (highwayRoomName == null) {
        return "no path?"
      }
      const highwayRoomCoordinate = RoomCoordinate.parse(highwayRoomName)
      if (highwayRoomCoordinate == null) {
        return "no coordinate?"
      }
      const detailedCoordinate = highwayRoomCoordinate.detailedCoordinate()
      if (detailedCoordinate.case !== "highway") {
        return "not highway?"
      }
      const highway = detailedCoordinate.highway
      return `${highway.direction} highway from ${roomLink(highway.startRoomName)} to ${roomLink(highway.endRoomName)}`
    })()
    return `${pathSteps.join(" =&gt ")} ${highwayDescription}`
  })
  return `${routes.length} route found\n${routeDescriptions.join("\n")}`
}

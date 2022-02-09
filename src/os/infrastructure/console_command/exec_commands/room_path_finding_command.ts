import { ListArguments } from "../utility/list_argument_parser"
import { RoomCoordinate } from "utility/room_name"
import { roomLink } from "utility/log"
import { RoomSector } from "utility/room_sector"

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
      "highway",
    ]
    return pathSteps.join(" =&gt ")
  })
  return `${routes.length} route found\n${routeDescriptions.join("\n")}`
}

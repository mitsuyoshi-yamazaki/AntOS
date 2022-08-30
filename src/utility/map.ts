import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomName } from "../shared/utility/room_name"

export function findRoomRoute(fromRoomName: RoomName, toRoomName: RoomName, waypoints: RoomName[]): RoomName[] {
  const result = ErrorMapper.wrapLoop((): RoomName[] => {
    const fullRoute: RoomName[] = []
    const routes: RoomName[] = [
      fromRoomName,
      ...waypoints,
      toRoomName,
    ]
    for (let i = 0; i < routes.length - 1; i += 1) {
      const from = routes[i]
      const to = routes[i + 1]
      if (from == null || to == null) {
        PrimitiveLogger.programError(`findRoomRoute unexpected null, from: ${fromRoomName}, to: ${toRoomName}, waypoints: ${waypoints}`)
        continue
      }
      const findResult = Game.map.findRoute(from, to)
      if (findResult === ERR_NO_PATH) {
        PrimitiveLogger.programError(`findRoomRoute returns ERR_NO_PATH, [${from} to ${to}], arguments: from: ${fromRoomName}, to: ${toRoomName}, waypoints: ${waypoints}`)
        return []
      }
      fullRoute.push(...findResult.map(room => room.room).filter(roomName => (fullRoute.includes(roomName) !== true)))
    }
    return fullRoute
  }, "findRoomRoute()")()

  if (result != null) {
    return result
  }
  PrimitiveLogger.programError(`findRoomRoute throws an exception, from: ${fromRoomName}, to: ${toRoomName}, waypoints: ${waypoints}`)
  return []
}

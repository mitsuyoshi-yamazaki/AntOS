import { RoomCoordinate, RoomName, RoomType } from "./room_name"

export class RoomSector {
  public get centerRoomName(): RoomName {
    return this._centerRoomCoordinate.roomName
  }
  public get allRoomNames(): RoomName[] {
    return this._allRoomCoordinates.map(coordinate => coordinate.roomName)
  }
  public get highwayCoordinates(): RoomCoordinate[] {
    if (this._highwayRoomCoordinates == null) {
      this._highwayRoomCoordinates = this.calculateHighwayCoordinates()
    }
    return this._highwayRoomCoordinates
  }

  private readonly _centerRoomCoordinate: RoomCoordinate
  private readonly _allRoomCoordinates: RoomCoordinate[]
  private _highwayRoomCoordinates: RoomCoordinate[] | null = null

  public constructor(containedRoomCoordinate: RoomCoordinate) {
    this._centerRoomCoordinate = RoomCoordinate.create(
      containedRoomCoordinate.direction,
      (Math.floor(containedRoomCoordinate.x / 10) * 10) + 5,
      (Math.floor(containedRoomCoordinate.y / 10) * 10) + 5,
    )

    this._allRoomCoordinates = []
    for (let j = -5; j <= 5; j += 1) {
      for (let i = -5; i <= 5; i += 1) {
        const roomCoordinate = RoomCoordinate.create(
          this._centerRoomCoordinate.direction,
          this._centerRoomCoordinate.x + i,
          this._centerRoomCoordinate.y + j,
        )
        this._allRoomCoordinates.push(roomCoordinate)
      }
    }
  }

  public getNearestHighwayRoutes(roomName: RoomName): RoomName[][] {
    if (this.highwayCoordinates.length <= 0) {
      return []
    }
    let result: RoomName[][] = []
    let shortestRouteLength = 100

    this.highwayCoordinates
      .map((coordinate: RoomCoordinate): RoomName[] => {
        const route = Game.map.findRoute(roomName, coordinate.roomName)
        if (route === ERR_NO_PATH) {
          return []
        }
        return route.map(obj => obj.room)
      })
      .forEach(route => {
        if (route.length <= 0) {
          return
        }
        if (route.length < shortestRouteLength) {
          shortestRouteLength = route.length
          result = [route]
        } else if (route.length === shortestRouteLength) {
          result.push(route)
        }
      })

    return result
  }

  // ---- Private ---- //
  private calculateHighwayCoordinates(): RoomCoordinate[] {
    const highwayRooms: RoomType[] = ["highway", "highway_crossing"]
    return this._allRoomCoordinates
      .filter(coordinate => highwayRooms.includes(coordinate.roomType))
  }
}

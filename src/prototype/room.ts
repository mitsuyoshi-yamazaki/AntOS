import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomCoordinate, RoomName, RoomType, roomTypeOf } from "utility/room_name"

/** @deprecated */
export interface RoomPathMemory {
  /** source paths */
  s: {
    /** source ID */
    [index: string]: {
      /** path */
      p: {
        x: number,
        y: number,
      }[]

      /** destination */
      d: {
        x: number,
        y: number,
      }
    } | "no path"
  }
}

declare global {
  interface Room {
    roomType: RoomType
    isHighway: boolean
    coordinate: RoomCoordinate
  }
}

// 毎tick呼び出すこと
export function init(): void {
  Object.defineProperty(Room.prototype, "roomType", {
    get(): RoomType {
      return roomTypeOf(this.name) ?? "normal"
    }
  })

  Object.defineProperty(Room.prototype, "isHighway", {
    get(): boolean {
      const roomType: RoomType = this.roomType
      return roomType === "highway" || roomType === "highway_crossing"
    }
  })

  Object.defineProperty(Room.prototype, "coordinate", {
    get(): RoomCoordinate {
      const roomName = this.name as RoomName
      const coordinate = RoomCoordinate.parse(roomName)
      if (coordinate == null) {
        PrimitiveLogger.programError(`Cannot parse ${roomName}`)
        return RoomCoordinate.create("NE", 0, 0)
      }
      return coordinate
    }
  })
}

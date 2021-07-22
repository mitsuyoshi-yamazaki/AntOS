import { RoomType, roomTypeOf } from "utility/room_name"

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
}

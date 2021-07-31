import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { GameConstants } from "utility/constants"

export function showOldRoomPlan(roomName: RoomName, layoutName: string, originX: number, originY: number): string {
  const room = Game.rooms[roomName]
  if (room == null) {
    return `Room ${roomLink(roomName)} is not visible`
  }

  room.show_layout(layoutName, { allow_partial: true, origin_pos: { x: originX, y: originY } })
  return "ok"
}

// Game.rooms["W53S36"].find(FIND_FLAGS).forEach(flag => flag.remove())
export function placeOldRoomPlan(roomName: RoomName, layoutName: string, originX: number, originY: number): string {
  const room = Game.rooms[roomName]
  if (room == null) {
    return `Room ${roomLink(roomName)} is not visible`
  }

  room.place_layout(layoutName, { allow_partial: true, origin_pos: { x: originX, y: originY } })
  return "ok"
}

export function describeLabs(roomName: RoomName): string {
  const room = Game.rooms[roomName]
  if (room == null) {
    return `Room ${roomLink(roomName)} is not visible`
  }
  const result = parseLabs(room)
  if (result == null) {
    return "Unrecognizable lab pattern"
  }

  return `inputs: ${result.inputLab1.pos}, ${result.inputLab2.pos}, outputs: ${result.outputLabs.length} labs`
}

// TODO: 完全ではない
export function parseLabs(room: Room): { inputLab1: StructureLab, inputLab2: StructureLab, outputLabs: StructureLab[] } | null {
  const labs = room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_LAB } }) as StructureLab[]
  let minX = GameConstants.room.edgePosition.max
  let maxX = GameConstants.room.edgePosition.min
  let minY = GameConstants.room.edgePosition.max
  let maxY = GameConstants.room.edgePosition.min

  labs.forEach(lab => {
    if (lab.pos.x < minX) {
      minX = lab.pos.x
    }
    if (lab.pos.x > maxX) {
      maxX = lab.pos.x
    }
    if (lab.pos.y < minY) {
      minY = lab.pos.y
    }
    if (lab.pos.y > maxY) {
      maxY = lab.pos.y
    }
  })

  const inputLabs: StructureLab[] = []
  const outputLabs: StructureLab[] = []

  labs.forEach(lab => {
    if (lab.pos.x > minX && lab.pos.x < maxX && lab.pos.y > minY && lab.pos.y < maxY) {
      inputLabs.push(lab)
    } else {
      outputLabs.push(lab)
    }
  })

  const inputLab1 = inputLabs[0]
  const inputLab2 = inputLabs[1]
  if (inputLab1 == null || inputLab2 == null || inputLabs.length !== 2) {
    return null
  }
  return {
    inputLab1,
    inputLab2,
    outputLabs,
  }
}

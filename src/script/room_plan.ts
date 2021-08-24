import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { GameConstants } from "utility/constants"
import { ValuedArrayMap } from "utility/valued_collection"
import { Result } from "utility/result"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { RoomPlanner } from "room_plan/room_planner"

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
  switch (result.resultType) {
  case "succeeded":
    return `inputs: ${result.value.inputLab1.pos}, ${result.value.inputLab2.pos}, outputs: ${result.value.outputLabs.length} labs`
  case "failed":
    return result.reason
  }
}

export function parseLabs(room: Room): Result<{ inputLab1: StructureLab, inputLab2: StructureLab, outputLabs: StructureLab[] }, string> {
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

  const labPattern = new ValuedArrayMap<number, StructureLab>()
  labs.forEach(lab => {
    const labPosition = ((): number => {
      if (lab.pos.x === minX || lab.pos.x === maxX || lab.pos.y === minY || lab.pos.y === maxY) {
        return 0
      }
      const x = Math.min(lab.pos.x - minX, maxX - lab.pos.x)
      const y = Math.min(lab.pos.y - minY, maxY - lab.pos.y)
      return x + y
    })()
    labPattern.getValueFor(labPosition).push(lab)
  })

  const inputLabs: StructureLab[] = []
  const outputLabs: StructureLab[] = []

  const getLabCount = (labPosition: number): number => labPattern.get(labPosition)?.length ?? 0
  if (getLabCount(0) === 8 && getLabCount(2) === 2) {
    inputLabs.push(...labPattern.getValueFor(2))
    outputLabs.push(...labPattern.getValueFor(0))
  } else if (getLabCount(0) === 4 && getLabCount(2) === 2 && getLabCount(3) === 4) {
    inputLabs.push(...labPattern.getValueFor(2))
    outputLabs.push(...labPattern.getValueFor(0))
    outputLabs.push(...labPattern.getValueFor(3))
  } else {
    const description: string[] = Array.from(labPattern.entries()).map(([labPosition, labs]) => `${labPosition}-${labs.length}`)
    return Result.Failed(`Unknown lab pattern: ${description.join(", ")}`)
  }

  const inputLab1 = inputLabs[0]
  const inputLab2 = inputLabs[1]
  if (inputLab1 == null || inputLab2 == null || inputLabs.length !== 2) {
    PrimitiveLogger.programError(`parseLabs() unexpected behavior (${inputLabs.length} inputLabs)`)
    return Result.Failed(`parseLabs() unexpected behavior (${inputLabs.length} inputLabs)`)
  }
  return Result.Succeeded({
    inputLab1,
    inputLab2,
    outputLabs,
  })
}

export function showRoomPlan(controller: StructureController, dryRun: boolean, showsCostMatrix: boolean): string {
  const roomPlanner = new RoomPlanner(controller, {dryRun, showsCostMatrix})
  const result = roomPlanner.run()
  switch (result.resultType) {
  case "succeeded":
    if (dryRun === true || showsCostMatrix === true) {
      return `dry_run: ${dryRun}, show_cost_matrix: ${showsCostMatrix}`
    }
    return "ok"
  case "failed":
    return result.reason
  }
}

import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"
import { Result } from "utility/result"
import { generateUniqueId } from "utility/unique_id"
import { GameConstants } from "utility/constants"
import type { RoomName } from "utility/room_name"

export function findPath(startObjectId: string, goalObjectId: string): string {
  const startObject = Game.getObjectById(startObjectId)
  if (!(startObject instanceof RoomObject) || startObject.room == null) {
    return `Game object of ${startObject} not found`
  }
  const goalObject = Game.getObjectById(goalObjectId)
  if (!(goalObject instanceof RoomObject) || goalObject.room == null) {
    return `Game object of ${goalObject} not found`
  }

  const options: FindPathOpts = {
    ignoreCreeps: true,
    ignoreDestructibleStructures: true,
    ignoreRoads: false,
    maxRooms: 3,
  }
  const startRoomName = startObject.room.name
  const startRoomPath = startObject.pos.findPathTo(goalObject.pos, options).map(p => {
    return new RoomPosition(p.x, p.y, startRoomName)
  })
  visualize(startRoomPath, { color: "#ffffff" })


  const goalRoomName = goalObject.room.name
  const edgePosition = startRoomPath[startRoomPath.length - 1]
  if (edgePosition == null) {
    return "No path"
  }
  const edgeRoomPosition = new RoomPosition(edgePosition.x, edgePosition.y, startRoomName)
  const goalRoomPath = goalObject.pos.findPathTo(edgeRoomPosition, options).map(p => {
    return new RoomPosition(p.x, p.y, goalRoomName)
  })
  visualize(goalRoomPath, { color: "#ffffff" })

  return "ok"
}

function visualize(positions: RoomPosition[], options?: { color?: string, text?: string }): void {
  const text = options?.text ?? "*"
  positions.forEach(position => {
    const room = Game.rooms[position.roomName]
    if (room == null) {
      return
    }
    room.visual.text(text, position, { color: options?.color, align: "center"})
  })
}

export function findPathToSource(spawnName: string, sourceId: Id<Source>): string {
  const spawn = Game.spawns[spawnName]
  if (spawn == null) {
    return `Spawn ${spawnName} not found`
  }
  const result = calculateSourceRoute(sourceId, spawn.pos)
  switch (result.resultType) {
  case "succeeded": {
    const harvestPositionDescription = result.value.harvestPositions.map(p => `(${p.x}, ${p.y})`).join(", ")
    return `Found ${result.value.harvestPositions.length} harvest positions: ${harvestPositionDescription}`
  }
  case "failed":
    return result.reason
  }
}

interface SourceRoute {
  path: PathFinderPath
  harvestPositions: RoomPosition[]
}

// TODO: Sourceが壁等で埋まっていたらよくないことが起きる
export function calculateSourceRoute(sourceId: Id<Source>, destination: RoomPosition): Result<SourceRoute, string> {
  const source = Game.getObjectById(sourceId)
  if (!(source instanceof Source)) {
    return Result.Failed(`Invalid source id ${sourceId}`)
  }

  const walkableTerrains: Terrain[] = ["swamp", "plain"]
  const harvestPositions = source.pos.neighbours().filter(position => {
    const objects = position.look()
    for (const obj of objects) {
      if (obj.type === LOOK_TERRAIN && obj.terrain != null && walkableTerrains.includes(obj.terrain)) {
        return true
      }
    }
    return false
  })
  visualize(harvestPositions, { text: "■", color: "#ff0000" })

  const pathFindResults: string[] = []
  const results: PathFinderPath[] = []
  harvestPositions.forEach(position => {
    const result = PathFinder.search(destination, { pos: position, range: 1 })
    if (result.incomplete === true) {
      pathFindResults.push(`Failed to find path (${position.x}, ${position.y})`)
      return
    }
    results.push(result)
  })

  // TODO: こういうのをテスタブルにしたい
  const shortestPath = results.reduce((lhs, rhs) => lhs.path.length < rhs.path.length ? lhs : rhs)
  const firstHarvestPosition = harvestPositions[0]
  const lastHarvestPosition = harvestPositions[harvestPositions.length - 1]
  if (shortestPath != null && harvestPositions.length > 0) {
    const lastPosition = shortestPath.path[shortestPath.path.length - 1]
    if (lastPosition != null && firstHarvestPosition != null && lastHarvestPosition != null) {
      if (lastPosition.isNearTo(firstHarvestPosition) === true) {
        // do nothing
      } else if (lastPosition.isNearTo(lastHarvestPosition) === true) {
        harvestPositions.reverse()
      } else {

        // FixMe: 必ずしも動かないわけではないが動くわけでもない
        PrimitiveLogger.fatal(`Pathfinder cannot calculate proper path to source ${sourceId} in ${roomLink(source.room.name)}`)
        harvestPositions.sort((lhs, rhs) => {
          const lValue = Math.abs(lhs.x - lastPosition.x) + Math.abs(lhs.y - lastPosition.y)
          const rValue = Math.abs(rhs.x - lastPosition.x) + Math.abs(rhs.y - lastPosition.y)
          if (lValue === rValue) {
            return 0
          }
          return lValue > rValue ? 1 : -1
        })

        // TODO:
        // const firstHarvestPosition = harvestPositions[0]
        // const lastHarvestPosition = harvestPositions[1]
        // if (firstHarvestPosition.getRangeTo(lastPosition) < lastHarvestPosition.getRangeTo(lastPosition)) {
        //   const betweenPositions = getPathBetween(firstHarvestPosition, lastPosition)
        //   if (betweenPositions == null) {

        //   }
        //   shortestPath.path.
        // } else {
        //   harvestPositions.reverse()
        // }
      }
    }
  }

  visualize(shortestPath.path, { color: "#ffffff" })

  if (shortestPath == null) {
    return Result.Failed(`No route found from (${destination.x}, ${destination.y}) to source (${source.pos.x}, ${source.pos.y})`)
  }

  const result: SourceRoute = {
    path: shortestPath,
    harvestPositions,
  }
  return Result.Succeeded(result)
}

// function getPathBetween(position1: RoomPosition, position2: RoomPosition): RoomPosition[] | null {
//   // TODO: 既存のパスに重ならないようなcost matrix
// }

const roadFlagColor = COLOR_BROWN
const roadRouteCost = {
  road: 5,
  plain: 10,
  swamp: 11,
  container: GameConstants.pathFinder.costs.obstacle - 1,
}

/**
 * - Owned roomにはflagを、そうでなければConstructionSiteを配置する
 * - startRoom, goalRoom以外の部屋をまたいだ経路には対応していない
 */
export function placeRoadConstructionMarks(startPosition: RoomPosition, goalPosition: RoomPosition, codename: string, options?: {dryRun?: boolean}): Result<string, string> {
  const startRoom = Game.rooms[startPosition.roomName]
  const goalRoom = Game.rooms[goalPosition.roomName]

  if (startRoom == null || goalRoom == null) {
    return Result.Failed(`No visual: ${startRoom}, ${goalRoom}`)
  }

  const costCallback = (roomName: string, costMatrix: CostMatrix): void | CostMatrix => {
    const room = Game.rooms[roomName]
    if (room == null) {
      return costMatrix
    }

    const roadPositions: RoomPosition[] = [
      ...room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_ROAD } }).map(road => road.pos),
      ...room.find(FIND_FLAGS, { filter: { color: roadFlagColor}}).map(flag => flag.pos),
    ]
    roadPositions.forEach(position => {
      costMatrix.set(position.x, position.y, roadRouteCost.road)
    })

    const containerPositions: RoomPosition[] = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } }).map(road => road.pos)
    containerPositions.forEach(position => {
      costMatrix.set(position.x, position.y, roadRouteCost.container)
    })

    return costMatrix
  }

  const findPathOpts: FindPathOpts = {
    ignoreCreeps: true,
    ignoreDestructibleStructures: false,
    ignoreRoads: false,
    plainCost: roadRouteCost.plain,
    swampCost: roadRouteCost.swamp,
    maxRooms: 3,
    range: 2,
    costCallback,
  }

  const placeMark = (room: Room, position: { x: number, y: number }): void => {
    if (options?.dryRun === true) {
      room.visual.text("#", position.x, position.y, {color: "#FF0000"})
      return
    }
    const result = room.createFlag(position.x, position.y, generateUniqueId(codename), roadFlagColor)
    switch (result) {
    case OK:
      return
    case ERR_NAME_EXISTS:
    case ERR_INVALID_ARGS:
    case ERR_FULL:
      PrimitiveLogger.programError(`placeRoadConstructionMarks() room.createFlag() returns ${result} in ${roomLink(room.name)}`)
      return
    }
  }

  const roomRoute = Game.map.findRoute(startPosition.roomName, goalPosition.roomName)
  if (roomRoute === ERR_NO_PATH) {
    return Result.Failed(`no route from ${roomLink(startPosition.roomName)} to ${roomLink(goalPosition.roomName)}`)
  }
  const roomNames = roomRoute.map(route => route.room)
  roomNames.push(goalPosition.roomName) // reduceでは次のRoom Nameを使用するため、最後にダミーの値を入れる

  try {
    const min = GameConstants.room.edgePosition.min + 1
    const max = GameConstants.room.edgePosition.max - 1
    const path = roomNames.reduce((result: { positions: RoomPosition[], start: RoomPosition }, current: RoomName) => {
      const roomName = result.start.roomName
      const pathPositions = result.start.findPathTo(goalPosition, findPathOpts)
        .map(step => (new RoomPosition(step.x, step.y, roomName)))

      const lastPosition = pathPositions[pathPositions.length - 1]
      if (lastPosition == null) {
        throw `placeRoadConstructionMarks() findPathTo() failed to find path from ${result.start} to ${goalPosition} (${roomLink(result.start.roomName)})`
      }
      const roomEdgePosition = ((): RoomPosition => {
        if (lastPosition.x <= min) {
          return new RoomPosition(max, lastPosition.y, current)
        } else if (lastPosition.x >= max) {
          return new RoomPosition(min, lastPosition.y, current)
        } else if (lastPosition.y <= min) {
          return new RoomPosition(lastPosition.x, max, current)
        } else if (lastPosition.y >= max) {
          return new RoomPosition(lastPosition.x, min, current)
        } else {
          if (current === goalPosition.roomName) {
            return result.start // 使用されないためダミーの値
          }
          throw `placeRoadConstructionMarks() findPathTo() incomplete. last step: ${lastPosition} (from ${result.start} to ${goalPosition}) (${roomLink(result.start.roomName)})`
        }
      })()

      // console.log(`${current}, ${lastPosition}`)

      return {
        positions: [
          ...result.positions,
          ...pathPositions,
        ],
        start: roomEdgePosition,
      }
    }, { positions: [], start: startPosition })

    const results: {roomName: RoomName, roadCount: number}[] = []
    const addResult = (roomName: RoomName): void => {
      const result = ((): { roomName: RoomName, roadCount: number } => {
        const stored = results[results.length - 1]
        if (stored != null && stored.roomName === roomName) {
          return stored
        }
        const newResult = {
          roomName,
          roadCount: 0,
        }
        results.push(newResult)
        return newResult
      })()

      result.roadCount += 1
    }

    path.positions.forEach(position => {
      const room = Game.rooms[position.roomName]
      if (room == null) {
        return
      }
      placeMark(room, position)
      addResult(room.name)
    })
    return Result.Succeeded(results.map(result => `${result.roadCount} in ${roomLink(result.roomName)}`).join(", "))

  } catch (error) {
    return Result.Failed(`${error}`)
  }
}

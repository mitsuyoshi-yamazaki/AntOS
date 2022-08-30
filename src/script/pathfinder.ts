import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText, roomLink } from "utility/log"
import { Result } from "shared/utility/result"
import { generateUniqueId } from "utility/unique_id"
import { GameConstants } from "utility/constants"
import type { RoomName } from "shared/utility/room_name"

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
 * - 途中の部屋までRoadが引かれている場合はある程度良い経路を選択する
 */
export function placeRoadConstructionMarks(startPosition: RoomPosition, sourcePosition: RoomPosition, codename: string, options?: { dryRun?: boolean, range?: number, disableRouteWaypoint?: boolean }): Result<RoomPosition[], string> {
  const calculator = new RemoteHarvesterRouteCalculator()
  return calculator.placeRoadConstructionMarks(startPosition, sourcePosition, codename, options)
}

export function calculateRoadPositionsFor(startPosition: RoomPosition, sourcePosition: RoomPosition): Result < RoomPosition[], string > {
  const calculator = new RemoteHarvesterRouteCalculator()
  return calculator.calculateRoadPositionsFor(startPosition, sourcePosition, 1)
}

class RemoteHarvesterRouteCalculator {
  private roadPositionMap = new Map<RoomName, RoomPosition[]>()

  private getRoadPositions(room: Room): RoomPosition[] {
    const stored = this.roadPositionMap.get(room.name)
    if (stored != null) {
      return stored
    }
    const positions: RoomPosition[] = [
      ...room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_ROAD } }).map(road => road.pos),
      ...room.find(FIND_FLAGS, { filter: { color: roadFlagColor } }).map(flag => flag.pos),
    ]
    this.roadPositionMap.set(room.name, positions)
    return positions
  }

  /**
   * @param options.disableRouteWaypoint 途中のRoomまで道が引かれている場合、その道から先の経路のみしか探索しない機能を無効化する
   */
  public placeRoadConstructionMarks(startPosition: RoomPosition, sourcePosition: RoomPosition, codename: string, options?: { dryRun?: boolean, range?: number, disableRouteWaypoint?: boolean }): Result<RoomPosition[], string> {
    const sourceRange = options?.range ?? 1

    const shortestRoomRoutes = calculateInterRoomShortestRoutes(startPosition.roomName, sourcePosition.roomName)

    const positionsByRoutes = shortestRoomRoutes.flatMap((route): { route: RoomPosition[], description: string }[] => {
      const waypointRoomName = route[0]
      if (waypointRoomName == null) {
        return []
      }
      const waypointRoom = Game.rooms[waypointRoomName]
      if (waypointRoom == null) {
        return []
      }
      const roadPositions = getRoadPositionsToParentRoom(startPosition.roomName, waypointRoom)
      if (roadPositions.length <= 0) {
        return []
      }

      return roadPositions.flatMap((roadPosition): { route: RoomPosition[], description: string }[] => {
        const result = calculateRoadPositionsFor(roadPosition, sourcePosition)
        switch (result.resultType) {
        case "succeeded":
          if (this.isValidRoute(roadPosition, sourcePosition, sourceRange, result.value) !== true) {
            return []
          }
          return [{
            route: result.value,
            description: `calculated from road position ${roadPosition}`,
          }]
        case "failed":
          PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} ${result.reason}`)
          return []
        }
      })
    })

    const shortestRoute = ((): RoomPosition[] | string => {
      if (options?.disableRouteWaypoint !== true) {
        positionsByRoutes.sort((lhs, rhs) => {
          return lhs.route.length - rhs.route.length
        })
        if (positionsByRoutes[0] != null) {
          return positionsByRoutes[0].route
        }
      }

      const alternativeRouteResult = calculateRoadPositionsFor(startPosition, sourcePosition)
      switch (alternativeRouteResult.resultType) {
      case "succeeded":
        return alternativeRouteResult.value
      case "failed":
        return alternativeRouteResult.reason
      }
    })()

    if (typeof shortestRoute === "string") {
      return Result.Failed(shortestRoute)
    }

    const placeMark = (room: Room, position: { x: number, y: number }): void => {
      const roadPositions = this.getRoadPositions(room)
      const placed = roadPositions.some(roadPosition => roadPosition.x === position.x && roadPosition.y === position.y)
      if (options?.dryRun === true) {
        const text = placed === true ? "*" : "#"
        room.visual.text(text, position.x, position.y, { color: "#FF0000" })
        return
      }

      if (placed === true) {
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

    shortestRoute.forEach(position => {
      const room = Game.rooms[position.roomName]
      if (room == null) {
        return
      }
      placeMark(room, position)
    })

    return Result.Succeeded(shortestRoute)
  }

  public calculateRoadPositionsFor(startPosition: RoomPosition, sourcePosition: RoomPosition, sourceRange: number): Result<RoomPosition[], string> {
    const costCallback = (roomName: string, costMatrix: CostMatrix): void | CostMatrix => {
      const room = Game.rooms[roomName]
      if (room == null) {
        return costMatrix
      }

      const roadPositions = this.getRoadPositions(room)
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
      // maxRooms: 3, // 設定すると経路を発見しない場合がある
      range: sourceRange,
      costCallback,
    }

    const roomRoute = Game.map.findRoute(startPosition.roomName, sourcePosition.roomName)
    if (roomRoute === ERR_NO_PATH) {
      return Result.Failed(`no route from ${roomLink(startPosition.roomName)} to ${roomLink(sourcePosition.roomName)}`)
    }
    const roomNames = roomRoute.map(route => route.room)
    roomNames.push(sourcePosition.roomName) // reduceでは次のRoom Nameを使用するため、最後にダミーの値を入れる

    try {
      const min = GameConstants.room.edgePosition.min
      const max = GameConstants.room.edgePosition.max
      const path = roomNames.reduce((result: { positions: RoomPosition[], start: RoomPosition }, nextRoomName: RoomName) => {
        const roomName = result.start.roomName
        const pathPositions = result.start.findPathTo(sourcePosition, findPathOpts)
          .map(step => (new RoomPosition(step.x, step.y, roomName)))

        const lastPosition = pathPositions[pathPositions.length - 1]
        if (lastPosition == null) {
          throw `placeRoadConstructionMarks() findPathTo() failed to find path from ${result.start} to ${sourcePosition} (${roomLink(result.start.roomName)})`
        }
        const roomEdgePosition = ((): RoomPosition => {
          if (lastPosition.x <= min) {
            return new RoomPosition(max, lastPosition.y, nextRoomName)
          } else if (lastPosition.x >= max) {
            return new RoomPosition(min, lastPosition.y, nextRoomName)
          } else if (lastPosition.y <= min) {
            return new RoomPosition(lastPosition.x, max, nextRoomName)
          } else if (lastPosition.y >= max) {
            return new RoomPosition(lastPosition.x, min, nextRoomName)
          } else {
            if (nextRoomName === sourcePosition.roomName) {
              return lastPosition // 使用されないためダミーの値
            }
            throw `placeRoadConstructionMarks() findPathTo() incomplete. last step: ${lastPosition} (from ${result.start} to ${sourcePosition}) (${roomLink(result.start.roomName)})`
          }
        })()

        return {
          positions: [
            ...result.positions,
            ...pathPositions,
          ],
          start: roomEdgePosition,
        }
      }, { positions: [], start: startPosition })

      return Result.Succeeded(path.positions)

    } catch (error) {
      return Result.Failed(`${error}`)
    }
  }

  private isValidRoute(startPosition: RoomPosition, goalPosition: RoomPosition, range: number, route: RoomPosition[]): boolean {
    try {
      const firstPosition = route[0]
      if (firstPosition == null) {
        throw "no route"
      }
      if (firstPosition.getRangeTo(startPosition) > 1) {
        throw `route does not reach to start position. first position: ${firstPosition}`
      }

      const min = GameConstants.room.edgePosition.min + 1
      const max = GameConstants.room.edgePosition.max - 1

      let previousPosition = firstPosition
      route.forEach(position => {
        if (position.roomName === previousPosition.roomName) {
          previousPosition = position
          return
        }

        if (previousPosition.x <= min) {
          if (previousPosition.nextRoomPositionTo(LEFT).roomName !== position.roomName) {
            throw `interrupted ${previousPosition} to ${position}`
          }
        } else if (previousPosition.x >= max) {
          if (previousPosition.nextRoomPositionTo(RIGHT).roomName !== position.roomName) {
            throw `interrupted ${previousPosition} to ${position}`
          }
        } else if (previousPosition.y <= min) {
          if (previousPosition.nextRoomPositionTo(TOP).roomName !== position.roomName) {
            throw `interrupted ${previousPosition} to ${position}`
          }
        } else if (previousPosition.y >= max) {
          if (previousPosition.nextRoomPositionTo(BOTTOM).roomName !== position.roomName) {
            throw `interrupted ${previousPosition} to ${position}`
          }
        }

        previousPosition = position
      })

      const lastPosition = route[route.length - 1]
      if (lastPosition == null) {
        throw "no route"
      }
      if (lastPosition.getRangeTo(goalPosition) > (range + 1)) {
        throw `route does not reach to last position. goal position: ${goalPosition}`
      }

      return true

    } catch (error) {
      PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} route ${startPosition} to ${goalPosition} is not valid: ${error}`)
      return false
    }
  }
}

export function getRoadPositionsToParentRoom(parentRoomName: RoomName, room: Room): RoomPosition[] {
  const min = GameConstants.room.edgePosition.min + 1
  const max = GameConstants.room.edgePosition.max - 1

  const exit = Game.map.findExit(room.name, parentRoomName)
  switch (exit) {
  case ERR_NO_PATH:
  case ERR_INVALID_ARGS:
    PrimitiveLogger.programError(`getRoadPositionsToParentRoom() Game.map.findExit() returns ${exit} from ${room.name} to ${parentRoomName}`)
    return []
  }

  const directionToParentRoom = exit

  const filter = ((): (position: RoomPosition) => boolean => {
    switch (directionToParentRoom) {
    case FIND_EXIT_TOP:
      return position => position.y === min
    case FIND_EXIT_BOTTOM:
      return position => position.y === max
    case FIND_EXIT_LEFT:
      return position => position.x === min
    case FIND_EXIT_RIGHT:
      return position => position.x === max
    }
  })()

  return room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_ROAD } }).flatMap((road): RoomPosition[] => {
    if (filter(road.pos) !== true) {
      return []
    }
    return [road.pos]
  })
}

/**
 * waypointが2部屋以上あるとひとつでも部屋がcheckedWaypointsに入ると別経路が無視されるため正確に算出されない
 */
export function calculateInterRoomShortestRoutes(fromRoomName: RoomName, toRoomName: RoomName): RoomName[][] {
  const checkedWaypoints: RoomName[] = []
  const addCheckedWaypoints = (route: RoomName[]): void => {
    route.pop()
    route.forEach(roomName => {
      if (checkedWaypoints.includes(roomName) === true) {
        return
      }
      checkedWaypoints.push(roomName)
    })
  }

  let result: RoomName[][] = []
  let minimumRouteLength = 1000
  const maxTry = 8

  const routeCallback = (roomName: string): number => {
    if (checkedWaypoints.includes(roomName) === true) {
      return Infinity
    }
    return 1
  }
  const routeOptions: RouteOptions = {
    routeCallback
  }

  for (let i = 0; i < maxTry; i += 1) {
    const route = Game.map.findRoute(fromRoomName, toRoomName, routeOptions)
    if (route === ERR_NO_PATH) {
      continue
    }
    const routeRoomNames = route.map(room => room.room)
    if (routeRoomNames.length > minimumRouteLength) {
      break
    }
    if (routeRoomNames.length < minimumRouteLength) {
      result = [routeRoomNames]
      minimumRouteLength = routeRoomNames.length
      addCheckedWaypoints([...routeRoomNames])
      continue
    }
    if (routeRoomNames.length === minimumRouteLength) {
      result.push(routeRoomNames)
      addCheckedWaypoints([...routeRoomNames])
      continue
    }
  }
  return result
}

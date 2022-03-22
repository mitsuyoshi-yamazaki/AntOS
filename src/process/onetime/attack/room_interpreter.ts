import { Position } from "prototype/room_position"
import { GameConstants } from "utility/constants"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { coloredText } from "utility/log"

const roomMinPosition = GameConstants.room.edgePosition.min
const roomMaxPosition = GameConstants.room.edgePosition.max

const Cost = {
  default: 0,
  exit: 1,
  constructedWall: 254,
  terrainWall: 255,
}

type ConstructedWall = StructureWall | StructureRampart

type CostMatrix = number[][]
const CostMatrix = {
  create(): CostMatrix {
    const defaultCost = Cost.default
    const costMatrix: CostMatrix = []

    for (let y = roomMinPosition; y <= roomMaxPosition; y += 1) {
      const row: number[] = []

      for (let x = roomMinPosition; x <= roomMaxPosition; x += 1) {
        row.push(defaultCost)
      }

      costMatrix.push(row)
    }
    return costMatrix
  },

  get(costMatrix: CostMatrix, position: Position): number {
    const row = costMatrix[position.y]
    if (row == null) {
      return 0
    }
    return row[position.x] ?? 0
  },

  getNeighbours(x: number, y: number): Position[] {
    const minX = Math.max(x - 1, roomMinPosition)
    const maxX = Math.min(x + 1, roomMaxPosition)
    const minY = Math.max(y - 1, roomMinPosition)
    const maxY = Math.min(y + 1, roomMaxPosition)

    const results: Position[] = []

    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        results.push({
          x,
          y,
        })
      }
    }
    return results
  },

  set(costMatrix: CostMatrix, value: number, ...args: [Position] | [number, number]): void {
    const [x, y] = ((): [number, number] => {
      if (typeof args[0] === "number") {
        return args as [number, number]
      }
      const position = args[0]
      return [position.x, position.y]
    })()

    const row = costMatrix[y]
    if (row == null) {
      return
    }
    row[x] = value
  },

  iterate(f: (x: number, y: number) => void): void {
    for (let y = roomMinPosition; y <= roomMaxPosition; y += 1) {
      for (let x = roomMinPosition; x <= roomMaxPosition; x += 1) {
        f(x, y)
      }
    }
  },

  /// terrain wall, wall, rampart
  fillWalls(costMatrix: CostMatrix, room: Room): void {
    this.iterate((x, y) => {
      const terrains = room.lookForAt(LOOK_TERRAIN, x, y)
      if (terrains.includes("wall") !== true) {
        return
      }
      this.set(costMatrix, Cost.terrainWall, x, y)
    })

    const setConstructedWallCosts = (constructedWalls: ConstructedWall[]): void => {
      constructedWalls.forEach(constructedWall => {
        const cost = CostMatrix.get(costMatrix, constructedWall.pos)
        if (cost >= Cost.constructedWall) {
          return
        }
        CostMatrix.set(costMatrix, Cost.constructedWall, constructedWall.pos)
      })
    }

    const walls = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } }) as StructureWall[]
    setConstructedWallCosts(walls)

    const ramparts = room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } }) as StructureRampart[]
    setConstructedWallCosts(ramparts)
  },

  fillEmptySpace(costMatrix: CostMatrix, exitPositions: Position[]): void {
    const uncheckedCost = Cost.default
    const minCost = Cost.exit + 1
    const maxCost = Cost.constructedWall
    let currentCostPositions = exitPositions

    for (let cost = minCost; cost < maxCost; cost += 1) {
      const nextCostPositions: Position[] = []

      currentCostPositions.forEach(position => {
        const neighbourPositions = this.getNeighbours(position.x, position.y)
        neighbourPositions.forEach(neighbourPosition => {
          const neighbourCost = this.get(costMatrix, neighbourPosition)
          if (neighbourCost !== uncheckedCost) {
            return
          }
          this.set(costMatrix, cost, neighbourPosition)
          nextCostPositions.push(neighbourPosition)
        })
      })

      if (nextCostPositions.length <= 0) {
        return
      }

      currentCostPositions = nextCostPositions
    }
  },
}

export namespace RoomInterpreter {
  type Bunker = {
    readonly spawns: StructureSpawn[]
    readonly towers: StructureTower[]
    readonly bunkerWalls: ConstructedWall[]
  }

  export type RoomInfo = {
    readonly bunkers: Bunker[]
  }

  export const interpret = (targetRoom: Room): RoomInfo => {
    const beforeRun = Game.cpu.getUsed()

    const vitalStructureTypes: StructureConstant[] = [
      STRUCTURE_SPAWN,
      STRUCTURE_TOWER,
      STRUCTURE_STORAGE,
      STRUCTURE_TERMINAL,
    ]

    const vitalStructures = getHostileStructures(vitalStructureTypes, targetRoom)
    const costMatrix = CostMatrix.create()
    CostMatrix.fillWalls(costMatrix, targetRoom)

    const allExitPositions = getConsecutiveExitPositions(targetRoom)

    allExitPositions.forEach(exitPositions => {
      exitPositions.forEach(exitPosition => {
        CostMatrix.set(costMatrix, Cost.exit, exitPosition)
      })
    })

    CostMatrix.fillEmptySpace(costMatrix, allExitPositions.flatMap(x => x))

    CostMatrix.iterate((x, y) => {
      targetRoom.visual.text(`${CostMatrix.get(costMatrix, { x, y })}`, x, y, {color: "#FFFFFF"})
    })

    PrimitiveLogger.log(`${coloredText("[Info]", "info")} RoomInterpreter.interpret() took ${Math.ceil(Game.cpu.getUsed() - beforeRun)} cpu (bucket: ${Game.cpu.bucket})`)

    return {
      bunkers: [] // TODO:
    }
  }
}

const getHostileStructures = (structureTypes: StructureConstant[], room: Room): OwnedStructure[] => {
  return room.find(FIND_HOSTILE_STRUCTURES).filter(structure => {
    if (structureTypes.includes(structure.structureType) !== true) {
      return false
    }
    if (structure.isActive() !== true) {
      return false
    }
    return true
  })
}

const getConsecutiveExitPositions = (room: Room): RoomPosition[][] => {
  const getEdgeExitPositions = (exitDirection: ExitConstant, sort: (lhs: RoomPosition, rhs: RoomPosition) => number): RoomPosition[][] => {
    const exitPositions: RoomPosition[][] = []
    const allExitPositions = room.find(exitDirection)
    allExitPositions.sort(sort)
    const firstExit = allExitPositions.shift()

    if (firstExit != null) {
      let exits: RoomPosition[] = [firstExit]
      exitPositions.push(exits)

      let anchorPosition = firstExit
      allExitPositions.forEach(exit => {
        if (exit.getRangeTo(anchorPosition) > 1) {
          exits = []
          exitPositions.push(exits)
        }
        anchorPosition = exit
        exits.push(exit)
      })
    }
    return exitPositions
  }

  const results: RoomPosition[][] = [
    ...getEdgeExitPositions(FIND_EXIT_TOP, (lhs, rhs) => lhs.pos.x - rhs.pos.x),
    ...getEdgeExitPositions(FIND_EXIT_BOTTOM, (lhs, rhs) => lhs.pos.x - rhs.pos.x),
    ...getEdgeExitPositions(FIND_EXIT_LEFT, (lhs, rhs) => lhs.pos.y - rhs.pos.y),
    ...getEdgeExitPositions(FIND_EXIT_RIGHT, (lhs, rhs) => lhs.pos.y - rhs.pos.y),
  ]

  return results
}

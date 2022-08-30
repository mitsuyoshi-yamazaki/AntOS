import { decodeRoomPosition, Position } from "prototype/room_position"
import { Timestamp } from "shared/utility/timestamp"
import { GameConstants, oppositeDirection } from "utility/constants"
import { CreepBody } from "utility/creep_body"
import { QuadCreepSpec, QuadSpec, QuadSpecState } from "../../../../submodules/private/attack/quad/quad_spec"
import { coloredResourceType, roomLink, shortenedNumber } from "utility/log"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { BoostTier, getBoostTier } from "shared/utility/resource"
import { RoomName } from "shared/utility/room_name"

type ConstructedWall = StructureWall | StructureRampart

const singleCreepMaxDamage = 3600

/**
 * - single/duoであれば攻略可能である場合
 */
export namespace AttackPlanner {
  type AttackerAction = "attack" | "dismantle" | "rangedAttack" | "heal"

  export type AttackPlanNone = {
    readonly case: "none"
    readonly reason: string
  }
  export type AttackPlanSingleCreep = {
    readonly case: "single_creep"
    readonly reason: string
    readonly boosts: MineralBoostConstant[]
    readonly body: BodyPartConstant[]
  }
  export type AttackPlanSingleQuad = {
    readonly case: "single_quad"
    readonly reason: string
    readonly quadSpecState: QuadSpecState
  }
  export type AttackPlan = AttackPlanNone | AttackPlanSingleCreep | AttackPlanSingleQuad

  export function describeAttackPlan(attackPlan: AttackPlan): string {
    switch (attackPlan.case) {
    case "none":
      return `attack plan cannot be created: ${attackPlan.reason}`

    case "single_creep":
      return [
        `single creep plan (${attackPlan.reason})`,
        `- boosts: ${attackPlan.boosts.map(boost => coloredResourceType(boost)).join(",")}`,
        `- body: ${CreepBody.description(attackPlan.body)}`,
      ].join("\n")

    case "single_quad": {
      const quadSpec = QuadSpec.decode(attackPlan.quadSpecState)
      return `attack plan (${attackPlan.reason})\n${quadSpec.description()}`
    }
    }
  }

  type TargetStructure<T extends Structure<BuildableStructureConstant>> = {
    readonly id: Id<T>
    readonly position: Position
    readonly rampartHits: number
  }

  type Bunker = {
    readonly towers: TargetStructure<StructureTower>[]
    readonly spawns: TargetStructure<StructureSpawn>[]
    readonly targetWalls: TargetStructure<ConstructedWall>[]
  }
  export type TargetRoomPlanNone = {
    case: "none"
    reason: string
  }
  export type TargetRoomPlanMultipleBunkers = {
    case: "multiple_bunkers"
    readonly calculatedAt: Timestamp
    readonly bunkers: Bunker[]
    readonly attackPlan: AttackPlan
  }
  export type TargetRoomPlan = TargetRoomPlanNone | TargetRoomPlanMultipleBunkers

  export const describeTargetRoomPlan = (targetRoomPlan: TargetRoomPlan): string => {
    switch (targetRoomPlan.case) {
    case "none":
      return `no room plan (${targetRoomPlan.reason})`
    case "multiple_bunkers": {
      const wallDescription = (walls: TargetStructure<ConstructedWall>[]): string => {
        if (walls.length <= 0) {
          return "no walls"
        }
        return `${walls.map(wall => `(${wall.position.x},${wall.position.y})`).join(",")} walls`
      }
      return [
        "multiple bunkers:",
        ...targetRoomPlan.bunkers.map(bunker => `- ${bunker.towers.length} towers, ${bunker.spawns.length} spawns, ${wallDescription(bunker.targetWalls)}`),
        describeAttackPlan(targetRoomPlan.attackPlan),
      ].join("\n")
    }
    }
  }

  interface PlannerInterface {
  }

  export class Planner implements PlannerInterface {
    public readonly targetRoomPlan: TargetRoomPlan

    public constructor(
      /// Occupyされている部屋
      private readonly targetRoom: Room,
    ) {
      try {
        this.targetRoomPlan = this.calculateRoomPlan(targetRoom)
      } catch (error) {
        if (error instanceof Error) {
          PrimitiveLogger.programError(`AttackPlanner.Planner.calculateRoomPlan() thrown an exception: ${error}\n${error.stack}`)
        }

        this.targetRoomPlan = {
          case: "none",
          reason: `${error}`,
        }
      }
    }

    /** @throws */
    private calculateRoomPlan(targetRoom: Room): TargetRoomPlan {
      // TODO: 複数bunkerの部屋を解釈できるようにする
      const bunker = ((): Bunker => {
        const towers = this.getStructure(STRUCTURE_TOWER, targetRoom) as TargetStructure<StructureTower>[]
        const spawns = this.getStructure(STRUCTURE_SPAWN, targetRoom) as TargetStructure<StructureSpawn>[]

        const targetWalls = ((): TargetStructure<ConstructedWall>[] => {
          const vitalStructure = targetRoom.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } })[0]
            ?? targetRoom.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })[0]
          if (vitalStructure == null) {
            return []
          }

          return getTargetWalls(targetRoom, vitalStructure).map(wall => {
            return {
              id: wall.id,
              position: { x: wall.pos.x, y: wall.pos.y },
              rampartHits: wall.hits,
            }
          })
        })()

        return {
          towers,
          spawns,
          targetWalls,
        }
      })()
      const bunkers: Bunker[] = [bunker]

      return {
        case: "multiple_bunkers",
        calculatedAt: Game.time,
        bunkers,
        attackPlan: this.calculateAttackPlanFor(bunkers),
      }
    }

    private getStructure<T extends BuildableStructureConstant>(structureType: T, room: Room): TargetStructure<Structure<T>>[] {
      const wallStructureTypes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART]
      const getRampartHits = (structure: Structure<T>): number => {
        if (wallStructureTypes.includes(structure.structureType) === true) {
          return structure.hits
        }
        const rampart = structure.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } })[0]
        if (rampart == null) {
          return 0
        }
        return rampart.hits
      }

      const structures: Structure<T>[] = room.find<Structure<T>>(FIND_STRUCTURES, { filter: { structureType: structureType } })
      return structures.map((structure): TargetStructure<Structure<T>> => {
        return {
          id: structure.id,
          position: { x: structure.pos.x, y: structure.pos.y },
          rampartHits: getRampartHits(structure),
        }
      })
    }

    private calculateAttackPlanFor(bunkers: Bunker[]): AttackPlan {
      const towerCount = bunkers.reduce((count, bunker) => count + bunker.towers.length, 0)
      const requiredHealPower = Math.max(towerCount * GameConstants.structure.tower.maxAttackPower, 100)
      const totalWallHits = bunkers.reduce((total, bunker) => {
        const bunkerStructures: { rampartHits: number }[] = [
          ...bunker.spawns,
          ...bunker.towers,
          ...bunker.targetWalls,
        ]
        return total + bunkerStructures.reduce((result, structure) => result + structure.rampartHits, 0)
      }, 0)

      try {
        const quadAttackPlan = this.calculateSingleQuadAttackPlan(requiredHealPower, totalWallHits)
        const boostMaxTier = getBoostMaxTier(quadAttackPlan.quadSpecState.boosts)
        if (boostMaxTier <= 1) {
          return quadAttackPlan
        }

        if (totalWallHits < 50000 && requiredHealPower <= singleCreepMaxDamage) {
          try {
            return this.calculateSingleCreepAttackPlan(requiredHealPower, totalWallHits)
          } catch (error) {
            if (error instanceof Error) {
              PrimitiveLogger.programError(`AttackPlanner.Planner.calculateSingleCreepAttackPlan() thrown an exception: ${error}\n${error.stack}`)
            }

            return {
              case: "none",
              reason: `${error}`,
            }
          }
        }

        return quadAttackPlan

      } catch (error) {
        if (error instanceof Error) {
          PrimitiveLogger.programError(`AttackPlanner.Planner.calculateAttackPlanFor() thrown an exception: ${error}\n${error.stack}`)
        }

        return {
          case: "none",
          reason: `${error}`,
        }
      }
    }

    /// Tier3 boost固定
    private calculateSingleCreepAttackPlan(requiredHealPower: number, totalWallHits: number): AttackPlanSingleCreep {
      if (requiredHealPower > singleCreepMaxDamage) {
        throw `a creep can't handle ${requiredHealPower} damage`
      }

      const boosts: MineralBoostConstant[] = [
        RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE,
        RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE,
        RESOURCE_CATALYZED_KEANIUM_ALKALIDE,
        RESOURCE_CATALYZED_GHODIUM_ALKALIDE,
      ]

      const toughDamageDecreasement = 0.3
      const toughHits = 100
      const toughCount = Math.ceil((Math.min(requiredHealPower * 1.2, singleCreepMaxDamage) * toughDamageDecreasement) / toughHits)

      const healPower = GameConstants.creep.actionPower.heal
      const healBoostTier = 3
      const healCount = Math.ceil((toughCount * toughHits) / (healPower * (healBoostTier + 1)))

      const bodyPartMaxCount = GameConstants.creep.body.bodyPartMaxCount
      const moveCount = Math.ceil(bodyPartMaxCount / 5)

      const rangedAttackCount = Math.min(bodyPartMaxCount - toughCount - healCount - moveCount, 10)
      if (rangedAttackCount <= 0) {
        PrimitiveLogger.fatal(`calculateSingleCreepAttackPlan() invalid ranged attack count ${rangedAttackCount} (requiredHealPower: ${requiredHealPower}, ${toughCount}T${healCount}H${rangedAttackCount}RA${moveCount}M)`)
        throw `invalid ranged attack count ${rangedAttackCount}`
      }

      return {
        case: "single_creep",
        reason: `estimated max damage: ${requiredHealPower}, total wall hits: ${shortenedNumber(totalWallHits)}`,
        boosts,
        body: [
          ...Array(toughCount).fill(TOUGH),
          ...Array(rangedAttackCount).fill(RANGED_ATTACK),
          ...Array(moveCount).fill(MOVE),
          ...Array(healCount).fill(HEAL),
        ],
      }
    }

    /** @throws */
    private calculateSingleQuadAttackPlan(requiredHealPower: number, totalWallHits: number): AttackPlanSingleQuad {
      // TODO: 現状ではboostなし、parent roomはRCL8想定、1Attacker,3Healer
      const bodyMaxLength = GameConstants.creep.body.bodyPartMaxCount
      const healerCount = 3
      const boosts: MineralBoostConstant[] = []
      const moveBoostTier = ((): BoostTier => {
        const baseHealPower = GameConstants.creep.actionPower.heal * Math.floor(bodyMaxLength / 2) * healerCount
        const tier0MoveMaxHealPower = baseHealPower
        if (requiredHealPower <= tier0MoveMaxHealPower) {
          return 0
        }

        const tier1MoveMaxHealPower = baseHealPower * 2
        if (requiredHealPower <= tier1MoveMaxHealPower) {
          return 1
        }

        // tier2 moveは使用しない
        const tier3MoveMaxHealPower = baseHealPower * 4
        if (requiredHealPower <= tier3MoveMaxHealPower) {
          return 3
        }
        throw `estimated damage too large ${requiredHealPower}`
      })()

      const movePartMaxLength = Math.ceil(bodyMaxLength / (moveBoostTier + 2))
      const workPartMaxLength = bodyMaxLength - movePartMaxLength
      const moveBoost = CreepBody.boostFor("fatigue", moveBoostTier)
      if (moveBoost != null) {
        boosts.push(moveBoost)
      }

      const { healerSpec, rangedAttackPower } = ((): { healerSpec: QuadCreepSpec, rangedAttackPower: number } => {
        const requiredHealPowerPerCreep = Math.ceil(requiredHealPower / healerCount)
        const maxHealCount = workPartMaxLength - 1
        const { bodyPartCount, boost } = this.bodyFor("heal", maxHealCount, requiredHealPowerPerCreep)
        if (boost != null) {
          boosts.push(boost)
        }

        const healCount = bodyPartCount

        const moveCount = movePartMaxLength
        const rangedAttackCount = bodyMaxLength - moveCount - healCount
        if (rangedAttackCount <= 0) {
          throw `invalid ranged attack count ${rangedAttackCount}, requiredHealPower: ${requiredHealPower}, moveBoostTier: ${moveBoostTier}, workPartMaxLength: ${workPartMaxLength}`
        }

        const rangedAttackBoostTier: BoostTier = moveBoostTier
        const rangedAttackBoost = CreepBody.boostFor("rangedAttack", rangedAttackBoostTier)
        if (rangedAttackBoost != null) {
          boosts.push(rangedAttackBoost)
        }

        const body: BodyPartConstant[] = [
          ...Array(rangedAttackCount).fill(RANGED_ATTACK),
          ...Array(moveCount).fill(MOVE),
          ...Array(healCount).fill(HEAL),
        ]
        if (body.length > bodyMaxLength) {
          throw `required ${healCount}HEALs/creep (estimated body: ${CreepBody.description(body)})`
        }

        const rangedAttackPower = rangedAttackCount * GameConstants.creep.actionPower.rangedAttack * (rangedAttackBoostTier + 1) * healerCount
        return {
          healerSpec: {
            body,
          },
          rangedAttackPower,
        }
      })()

      const { attackerSpec, canHandleMelee } = ((): { attackerSpec: QuadCreepSpec, canHandleMelee: boolean } => {
        const attackDuration = 1000
        const requiredTotalDismantlePower = Math.ceil(totalWallHits / attackDuration)
        const requiredDismantlePower = Math.max(requiredTotalDismantlePower - rangedAttackPower, 0)

        const hasEnoughAttackPower = rangedAttackPower > 400

        if (hasEnoughAttackPower === true) {
          const workCount = workPartMaxLength
          const boost = this.boostFor("dismantle", workCount, requiredDismantlePower)
          if (boost != null) {
            boosts.push(boost)
          }

          const moveCount = movePartMaxLength
          return {
            attackerSpec: {
              body: [
                ...Array(workCount).fill(WORK),
                ...Array(moveCount).fill(MOVE),
              ],
            },
            canHandleMelee: false,
          }

        } else {
          const attackCount = workPartMaxLength
          const boost = this.boostFor("attack", attackCount, requiredDismantlePower)
          if (boost != null) {
            boosts.push(boost)
          }

          const moveCount = movePartMaxLength
          return {
            attackerSpec: {
              body: [
                ...Array(attackCount).fill(ATTACK),
                ...Array(moveCount).fill(MOVE),
              ],
            },
            canHandleMelee: true,
          }
        }
      })()

      const creepSpecs: QuadCreepSpec[] = [
        ...Array(3).fill(healerSpec),
        attackerSpec,
      ]
      const quadSpec = new QuadSpec(
        `auto_${this.targetRoom.name}`,
        canHandleMelee,
        QuadSpec.defaultDamageTolerance,
        boosts,
        creepSpecs,
      )

      return {
        case: "single_quad",
        reason: `estimated max damage: ${requiredHealPower}, total wall hits: ${shortenedNumber(totalWallHits)}`,
        quadSpecState: quadSpec.encode(),
      }
    }

    /** @throws */
    private boostFor(action: AttackerAction, maxPartCount: number, requiredActionPower: number): MineralBoostConstant | null {
      const maxPower = maxPartCount * GameConstants.creep.actionPower[action]
      const boostTier = Math.max(Math.ceil(requiredActionPower / maxPower) - 1, 0)  // FixMe: toughなど線形に比例しないものは未対応
      switch (boostTier) {
      case 0:
        return null
      case 1:
      case 2:
      case 3:
        return CreepBody.boostFor(action, boostTier)
      default:
        throw `not enough ${action} power, required: ${shortenedNumber(requiredActionPower)}, estimated boost: ${boostTier}x`
      }
    }

    /** @throws */
    private bodyFor(action: AttackerAction, maxPartCount: number, requiredActionPower: number): { bodyPartCount: number, boost: MineralBoostConstant | null } {
      const actionPower = GameConstants.creep.actionPower[action]
      const requiredBodyPartCount = (boostTier: number): number => {
        return Math.ceil(requiredActionPower / (actionPower * (boostTier + 1)))
      }

      const maxPower = maxPartCount * actionPower
      const boostTier = Math.max(Math.ceil(requiredActionPower / maxPower) - 1, 0)  // FixMe: toughなど線形に比例しないものは未対応
      switch (boostTier) {
      case 0:
        return {
          bodyPartCount: requiredBodyPartCount(boostTier),
          boost: null,
        }
      case 1:
      case 2:
      case 3:
        return {
          bodyPartCount: requiredBodyPartCount(boostTier),
          boost: CreepBody.boostFor(action, boostTier),
        }
      default:
        throw `not enough ${action} power, required: ${shortenedNumber(requiredActionPower)}, estimated boost: ${boostTier}x`
      }
    }
  }
}

function getBoostMaxTier(boosts: MineralBoostConstant[]): BoostTier {
  return boosts.reduce((maxTier, boost) => {
    const tier = getBoostTier(boost as MineralBoostConstant)
    if (maxTier >= tier) {
      return maxTier
    }
    return tier
  }, 0 as BoostTier)
}

const quadMemberDirections: DirectionConstant[] = [
  TOP,
  RIGHT,
  TOP_RIGHT,
]
const quadMemberDirectionsForCostMatrix = quadMemberDirections.map(direction => oppositeDirection(direction))
const getQuadMemberPositions = (position: RoomPosition): RoomPosition[] => {
  return quadMemberDirections.flatMap(direction => position.positionTo(direction) ?? [])
}
const getQuadMemberPositionsForCostMatrix = (position: RoomPosition): RoomPosition[] => {
  return quadMemberDirectionsForCostMatrix.flatMap(direction => position.positionTo(direction) ?? [])
}

/// Quad想定
/** @throws */
const getTargetWalls = (room: Room, vitalStructure: OwnedStructure): ConstructedWall[] => {
  const exit = room.find(FIND_EXIT)[0]
  if (exit == null) {
    throw `no exits in room ${roomLink(room.name)}`
  }

  const constructedWalls: ConstructedWall[] = [
    ...room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_WALL } }) as StructureWall[],
    ...room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } }) as StructureRampart[],
  ]

  const pathFinderOptions: FindPathOpts = {
    costCallback: quadCostCallback(room, constructedWalls),
    range: 1,
    ignoreCreeps: true,
    maxRooms: 1,
    ignoreDestructibleStructures: true,
  }

  const path = room.findPath(exit.pos, vitalStructure.pos, pathFinderOptions)

  path.forEach(pathPosition => {
    room.visual.text("*", pathPosition.x, pathPosition.y, {color: "#FFFFFF"})
  })

  const positionIdentifier = (position: Position): string => {
    return `${position.x},${position.y}`
  }

  const constructedWallByPosition = new Map<string, ConstructedWall>()
  constructedWalls.forEach(constructedWall => {
    constructedWallByPosition.set(positionIdentifier(constructedWall.pos), constructedWall)
  })

  const results: ConstructedWall[] = []

  path.forEach(pathPosition => {
    const constructedWall = constructedWallByPosition.get(positionIdentifier(pathPosition))
    if (constructedWall == null) {
      return
    }
    if (results.includes(constructedWall) !== true) {
      results.push(constructedWall)
    }

    const roomPosition = decodeRoomPosition(pathPosition, room.name)
    getQuadMemberPositions(roomPosition).forEach(position => {
      const wall = constructedWallByPosition.get(positionIdentifier(position))
      if (wall == null) {
        return
      }
      if (results.includes(wall) !== true) {
        results.push(wall)
      }
    })
  })

  results.forEach(wall => {
    room.visual.text("■", wall.pos.x, wall.pos.y, { color: "#FF0000" })
  })

  return results
}

// TODO: CostMatrixのキャッシュはできるかも
function quadCostCallback(room: Room, constructedWalls: ConstructedWall[]): (roomName: RoomName, costMatrix: CostMatrix) => CostMatrix {
  return (roomName: RoomName, costMatrix: CostMatrix): CostMatrix => {
    if (roomName !== room.name) {
      return costMatrix
    }

    const setCostTo = (position: RoomPosition, cost: number): void => {
      if (costMatrix.get(position.x, position.y) < cost) {
        costMatrix.set(position.x, position.y, cost)
      }
      getQuadMemberPositionsForCostMatrix(position).forEach(p => {
        if (costMatrix.get(p.x, p.y) < cost) {
          costMatrix.set(p.x, p.y, cost)
        }
      })
    }

    const obstacleCost = GameConstants.pathFinder.costs.obstacle
    const swampCost = GameConstants.pathFinder.costs.swamp
    const roomMinEdge = GameConstants.room.edgePosition.min
    const roomMaxEdge = GameConstants.room.edgePosition.max
    const exitPositionCost = obstacleCost - 1
    const constructedWallCost = obstacleCost - 1

    for (let y = roomMinEdge; y <= roomMaxEdge; y += 1) {
      for (let x = roomMinEdge; x <= roomMaxEdge; x += 1) {
        const position = new RoomPosition(x, y, roomName)
        if (position.isRoomEdge === true) {
          setCostTo(position, exitPositionCost)
          continue
        }

        const fieldType = getFieldType(position)
        switch (fieldType) {
        case "plain":
          break

        case "swamp":
          setCostTo(position, swampCost)
          break

        case "terrain_wall":
          setCostTo(position, obstacleCost)
          break
        }
      }
    }

    constructedWalls.forEach(constructedWall => {
      setCostTo(constructedWall.pos, constructedWallCost)
    })

    for (let y = roomMinEdge; y <= roomMaxEdge; y += 1) {
      for (let x = roomMinEdge; x <= roomMaxEdge; x += 1) {
        const costDescription = ((): string => {
          const cost = costMatrix.get(x, y)
          if (cost === obstacleCost) {
            return "■"
          }
          return `${cost}`
        })()
        room.visual.text(costDescription, x, y, {color: "#FFFFFF"})
      }
    }

    return costMatrix
  }
}

function getFieldType(position: RoomPosition): "terrain_wall" | "swamp" | "plain" {
  const terrain = position.lookFor(LOOK_TERRAIN)[0]
  switch (terrain) {
  case "plain":
    return "plain"
  case "swamp":
    return "swamp"
  case "wall":
    return "terrain_wall"
  default:
    PrimitiveLogger.programError(`Unexpected terrain ${terrain} at ${position} in ${roomLink(position.roomName)}`)
    return "terrain_wall"
  }
}

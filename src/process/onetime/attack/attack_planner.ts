import { Position } from "prototype/room_position"
import { Timestamp } from "utility/timestamp"
import { GameConstants } from "utility/constants"
import { CreepBody } from "utility/creep_body"
import { QuadCreepSpec, QuadSpec, QuadSpecState } from "../../../../submodules/private/attack/quad/quad_spec"
import { shortenedNumber } from "utility/log"

/**
 * - どの入り口から入るか、どのwallを攻撃するか最初は手動で設定する
 */
export namespace AttackPlanner {
  type AttackerAction = "attack" | "dismantle" | "rangedAttack" | "heal"

  export type AttackPlanNone = {
    readonly case: "none"
    readonly reason: string
  }
  export type AttackPlanSingleQuad = {
    readonly case: "single_quad"
    readonly quadSpecState: QuadSpecState
  }
  export type AttackPlan = AttackPlanNone | AttackPlanSingleQuad

  type TargetStructure<T extends Structure<BuildableStructureConstant>> = {
    readonly id: Id<T>
    readonly position: Position
    readonly rampartHits: number
  }

  type Bunker = {
    readonly towers: TargetStructure<StructureTower>[]
    readonly spawns: TargetStructure<StructureSpawn>[]
    readonly targetWalls: TargetStructure<StructureWall | StructureRampart>[]
  }
  export type TargetRoomPlan = {
    readonly calculatedAt: Timestamp
    readonly bunkers: Bunker[]
    readonly attackPlan: AttackPlan
  }

  interface PlannerInterface {
  }

  export class Planner implements PlannerInterface {
    public readonly targetRoomPlan: TargetRoomPlan

    public constructor(
      /// Occupyされている部屋
      private readonly targetRoom: Room,
    ) {
      this.targetRoomPlan = this.calculateRoomPlan(targetRoom)
    }

    private calculateRoomPlan(targetRoom: Room): TargetRoomPlan {
      // TODO: 複数bunkerの部屋を解釈できるようにする
      const bunker: Bunker = {
        towers: this.getStructure(STRUCTURE_TOWER, targetRoom) as TargetStructure<StructureTower>[],
        spawns: this.getStructure(STRUCTURE_SPAWN, targetRoom) as TargetStructure<StructureSpawn>[],
        targetWalls: [],  // TODO:
      }
      const bunkers: Bunker[] = [bunker]

      return {
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

      // TODO: 現状ではboostなし、parent roomはRCL8想定、1Attacker,3Healer
      try {
        const bodyMaxLength = GameConstants.creep.body.bodyPartMaxCount
        const healerCount = 3
        const boosts: MineralBoostConstant[] = []

        const { healerSpec, rangedAttackPower } = ((): { healerSpec: QuadCreepSpec, rangedAttackPower: number } => {
          const requiredHealPower = towerCount * GameConstants.structure.tower.maxAttackPower
          const requiredHealPowerPerCreep = Math.ceil(requiredHealPower / healerCount)
          const maxHealCount = Math.floor(bodyMaxLength / 2) - 1
          const { bodyPartCount, boost } = this.bodyFor("heal", maxHealCount, requiredHealPowerPerCreep)
          if (boost != null) {
            boosts.push(boost)
          }

          const healCount = bodyPartCount

          const moveCount = Math.floor(bodyMaxLength / 2)
          const rangedAttackCount = bodyMaxLength - moveCount - healCount

          const body: BodyPartConstant[] = [
            ...Array(rangedAttackCount).fill(RANGED_ATTACK),
            ...Array(moveCount).fill(MOVE),
            ...Array(healCount).fill(HEAL),
          ]
          if (body.length > bodyMaxLength) {
            throw `required ${healCount}HEALs/creep (estimated body: ${CreepBody.description(body)})`
          }

          const rangedAttackPower = rangedAttackCount * healerCount

          return {
            healerSpec: {
              body,
            },
            rangedAttackPower,
          }
        })()

        const { attackerSpec, canHandleMelee } = ((): { attackerSpec: QuadCreepSpec, canHandleMelee: boolean} => {
          const totalWallHits = bunkers.reduce((total, bunker) => {
            const bunkerStructures: { rampartHits: number }[] = [
              ...bunker.spawns,
              ...bunker.towers,
              ...bunker.targetWalls,
            ]
            return total + bunkerStructures.reduce((result, structure) => result + structure.rampartHits, 0)
          }, 0)
          const attackDuration = 1000
          const requiredTotalDismantlePower = Math.ceil(totalWallHits / attackDuration)
          const requiredDismantlePower = Math.max(requiredTotalDismantlePower - rangedAttackPower, 0)

          const hasEnoughAttackPower = rangedAttackPower > 400

          if (hasEnoughAttackPower === true) {
            const workCount = bodyMaxLength / 2
            const boost = this.boostFor("dismantle", workCount, requiredDismantlePower)
            if (boost != null) {
              boosts.push(boost)
            }

            const moveCount = bodyMaxLength - workCount
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
            const attackCount = bodyMaxLength / 2
            const boost = this.boostFor("attack", attackCount, requiredDismantlePower)
            if (boost != null) {
              boosts.push(boost)
            }

            const moveCount = bodyMaxLength - attackCount

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
          quadSpecState: quadSpec.encode(),
        }

      } catch (error) {
        return {
          case: "none",
          reason: `${error}`,
        }
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

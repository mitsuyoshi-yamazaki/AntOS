import { Position } from "prototype/room_position"
import { Timestamp } from "utility/timestamp"
import { QuadMaker, QuadMakerState } from "../quad_maker/quad_maker"
import { GameConstants } from "utility/constants"
import { CreepBody } from "utility/creep_body"
import { QuadCreepSpec } from "../../../../submodules/private/attack/quad/quad_spec"
import { RoomName } from "utility/room_name"

/**
 * - どの入り口から入るか、どのwallを攻撃するか最初は手動で設定する
 * - Rampart hits考慮を入れる
 */
export namespace AttackPlanner {
  export type AttackPlanNone = {
    readonly case: "none"
    readonly reason: string
  }
  export type AttackPlanSingleQuad = {
    readonly case: "single_quad"
    readonly quadMakerState: QuadMakerState
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
      private readonly parentRoomName: RoomName,

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

      // TODO: 現状ではboostなし、RCL8想定、1Attacker,3Healer
      try {
        const bodyMaxLength = GameConstants.creep.body.bodyPartMaxCount
        const healerSpec = ((): QuadCreepSpec => {
          const requiredHealPower = towerCount * GameConstants.structure.tower.maxAttackPower
          const requiredHealCount = Math.ceil(requiredHealPower / GameConstants.creep.actionPower.heal)
          const healCount = Math.max(Math.ceil(requiredHealCount / 3), 4)

          const rangedAttackCount = (bodyMaxLength / 2) - healCount
          const moveCount = healCount + rangedAttackCount

          const body: BodyPartConstant[] = [
            ...Array(rangedAttackCount).fill(RANGED_ATTACK),
            ...Array(moveCount).fill(MOVE),
            ...Array(healCount).fill(HEAL),
          ]
          if (body.length > bodyMaxLength) {
            throw `required ${healCount}HEALs/creep (estimated body: ${CreepBody.description(body)})`
          }

          return {
            body,
          }
        })()

        const attackerSpec = ((): QuadCreepSpec => {
          const attackCount = bodyMaxLength / 2
          const moveCount = attackCount

          return {
            body: [
              ...Array(attackCount).fill(ATTACK),
              ...Array(moveCount).fill(MOVE),
            ],
          }
        })()

        const quadMaker = QuadMaker.create("auto", this.parentRoomName, this.targetRoom.name)
        quadMaker.boosts = []
        quadMaker.canHandleMelee = true
        quadMaker.creepSpecs = [
          ...Array(3).fill(healerSpec),
          attackerSpec,
        ]

        return {
          case: "single_quad",
          quadMakerState: quadMaker.encode(),
        }

      } catch (error) {
        return {
          case: "none",
          reason: `${error}`,
        }
      }
    }
  }

}

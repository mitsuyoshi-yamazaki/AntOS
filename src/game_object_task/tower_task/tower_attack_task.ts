import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { StructureTowerTask, StructureTowerTaskState } from "game_object_task/tower_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

export type TowerAttackTaskTargetType = Creep | PowerCreep

export interface TowerAttackTaskState extends StructureTowerTaskState {
  /** target id */
  i: Id<TowerAttackTaskTargetType>
}

export class TowerAttackTask implements StructureTowerTask {
  public get targetId(): Id<TowerAttackTaskTargetType> {
    return this.target.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly target: TowerAttackTaskTargetType,
  ) { }

  public encode(): TowerAttackTaskState {
    return {
      s: this.startTime,
      t: "AttackTask",
      i: this.target.id,
    }
  }

  public static decode(state: TowerAttackTaskState): TowerAttackTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new TowerAttackTask(state.s, target)
  }

  public run(tower: StructureTower): GameObjectTaskReturnCode {
    const result = tower.attack(this.target)

    switch (result) {
    case OK:
    case ERR_NOT_ENOUGH_ENERGY:
      return "in progress"

    case ERR_NOT_OWNER:
      PrimitiveLogger.log(`tower.attack() returns ERR_NOT_OWNER possibly programming bug (tower: ${tower.id} in ${roomLink(tower.room.name)})`)
      return "failed"

    case ERR_INVALID_TARGET:
      PrimitiveLogger.log(`tower.attack() returns ERR_INVALID_TARGET possibly programming bug (tower: ${tower.id} in ${roomLink(tower.room.name)}, target ID: ${this.target.id})`)
      return "failed"

    case ERR_RCL_NOT_ENOUGH:
      PrimitiveLogger.log(`tower.attack() returns ERR_RCL_NOT_ENOUGH possibly programming bug (tower: ${tower.id} in ${roomLink(tower.room.name)})`)
      return "failed"

    default:
      PrimitiveLogger.log(`tower.attack() returns unexpected return code: ${result}, (tower: ${tower.id} in ${roomLink(tower.room.name)})`)
      return "failed"
    }
  }
}

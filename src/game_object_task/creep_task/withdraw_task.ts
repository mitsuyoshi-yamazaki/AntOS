import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

type WithdrawTaskTargetType = StructureStorage | StructureTerminal | StructureLab

export interface WithdrawTaskState extends CreepTaskState {
  /** target id */
  i: Id<WithdrawTaskTargetType>

  /** resource */
  r: ResourceConstant
}

export class WithdrawTask implements CreepTask {
  public readonly shortDescription = "withdraw"
  public get targetId(): Id<WithdrawTaskTargetType> {
    return this.target.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly target: WithdrawTaskTargetType,
    public readonly resource: ResourceConstant,
  ) { }

  public encode(): WithdrawTaskState {
    return {
      s: this.startTime,
      t: "WithdrawTask",
      i: this.target.id,
      r: this.resource,
    }
  }

  public static decode(state: WithdrawTaskState): WithdrawTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new WithdrawTask(state.s, target, state.r)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    creep.memory.tt = Game.time
    const result = creep.withdraw(this.target, this.resource)

    switch (result) {
    case OK:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_FULL:
      return "finished"

    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.target, { reusePath: 0 })
      return "in progress"

    case ERR_INVALID_TARGET:
      PrimitiveLogger.fatal(`creep.withdraw() returns ERR_INVALID_TARGET, ${roomLink(creep.room.name)}, creep: ${creep.name} tried to withdraw ${this.resource} from ${this.target.structureType} ${this.target.id}`)
      return "failed"

    case ERR_INVALID_ARGS:
      PrimitiveLogger.fatal(`creep.withdraw() returns ERR_INVALID_ARGS, ${roomLink(creep.room.name)}, creep: ${creep.name} tried to withdraw ${this.resource} from ${this.target.structureType} ${this.target.id}`)
      return "failed"

    case ERR_NOT_OWNER:
    case ERR_NO_BODYPART:
      return "failed"

    case ERR_BUSY:
    default:
      return "in progress"
    }
  }
}

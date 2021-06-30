import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { roomLink } from "utility/log"

type TransferTaskTargetType = StructureStorage | StructureTerminal | StructureLab

export interface TransferTaskState extends CreepTaskState {
  /** target id */
  i: Id<TransferTaskTargetType>

  /** resource */
  r: ResourceConstant
}

export class TransferTask implements CreepTask {
  public readonly shortDescription = "transfer"
  public get targetId(): Id<TransferTaskTargetType> {
    return this.target.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly target: TransferTaskTargetType,
    public readonly resource: ResourceConstant,
  ) { }

  public encode(): TransferTaskState {
    return {
      s: this.startTime,
      t: "TransferTask",
      i: this.target.id,
      r: this.resource,
    }
  }

  public static decode(state: TransferTaskState): TransferTask | null {
    const target = Game.getObjectById(state.i)
    if (target == null) {
      return null
    }
    return new TransferTask(state.s, target, state.r)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    creep.memory.tt = Game.time
    const result = creep.transfer(this.target, this.resource)

    switch (result) {
    case OK:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_FULL:
      return "finished"

    case ERR_NOT_IN_RANGE:
      creep.moveTo(this.target, { reusePath: 0 })
      return "in progress"

    case ERR_INVALID_TARGET:
      PrimitiveLogger.fatal(`creep.transfer() returns ERR_INVALID_TARGET, ${roomLink(creep.room.name)}, creep: ${creep.name} tried to withdraw ${this.resource} from ${this.target.structureType} ${this.target.id}`)
      return "failed"

    case ERR_INVALID_ARGS:
      PrimitiveLogger.fatal(`creep.transfer() returns ERR_INVALID_ARGS, ${roomLink(creep.room.name)}, creep: ${creep.name} tried to withdraw ${this.resource} from ${this.target.structureType} ${this.target.id}`)
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

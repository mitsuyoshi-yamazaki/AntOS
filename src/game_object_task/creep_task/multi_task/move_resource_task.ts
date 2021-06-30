import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { TransferTask, TransferTaskTargetType } from "../transfer_task"
import { WithdrawTask, WithdrawTaskTargetType } from "../withdraw_task"

export interface MoveResourceTaskState extends CreepTaskState {
  /** withdraw target id */
  w: Id<WithdrawTaskTargetType>

  /** transfer target id */
  tt: Id<TransferTaskTargetType>

  /** resource */
  r: ResourceConstant
}

export class MoveResourceTask implements CreepTask {
  public readonly shortDescription = "move_rsc"
  public get targetId(): Id<TransferTaskTargetType> {  // TODO: withdraw targetを含められるよう変更する
    return this.transferTo.id
  }

  public constructor(
    public readonly startTime: number,
    public readonly withdrawFrom: WithdrawTaskTargetType,
    public readonly transferTo: TransferTaskTargetType,
    public readonly resource: ResourceConstant,
  ) { }

  public encode(): MoveResourceTaskState {
    return {
      s: this.startTime,
      t: "MoveResourceTask",
      w: this.withdrawFrom.id,
      tt: this.transferTo.id,
      r: this.resource,
    }
  }

  public static decode(state: MoveResourceTaskState): MoveResourceTask | null {
    const withdrawFrom = Game.getObjectById(state.w)
    if (withdrawFrom == null) {
      return null
    }
    const transferTo = Game.getObjectById(state.tt)
    if (transferTo == null) {
      return null
    }
    return new MoveResourceTask(state.s, withdrawFrom, transferTo, state.r)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    creep.memory.tt = Game.time

    if (creep.store.getUsedCapacity(this.resource) <= 0) {
      return this.runWithdrawTask(creep)
    } else {
      return this.runTransferTask(creep)
    }
  }

  private runWithdrawTask(creep: Creep): GameObjectTaskReturnCode {
    const result = new WithdrawTask(this.startTime, this.withdrawFrom, this.resource).run(creep)
    switch (result) {
    case "in progress":
    case "finished":
      return "in progress"
    case "failed":
      return "failed"
    }
  }

  private runTransferTask(creep: Creep): GameObjectTaskReturnCode {
    return new TransferTask(this.startTime, this.transferTo, this.resource).run(creep)
  }
}

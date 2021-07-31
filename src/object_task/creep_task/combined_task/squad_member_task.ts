import type { TaskTarget } from "object_task/object_task_target_cache"
import { V6Creep } from "prototype/creep"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface SquadMemberTaskState extends CreepTaskState {
  /** type identifier */
  t: "SquadMemberTask"

  /** manuscripts */
  m: string[]

  /** task state */
  st: {
    /** child task state */
    c: CreepTaskState
  }
}

// TODO: SquadTaskへの参照をもたせる
export class SquadMemberTask implements CreepTask {
  public readonly shortDescription: string

  private constructor(
    public readonly startTime: number,
    public readonly childTask: CreepTask,
    public readonly manuscripts: string[],
  ) {
    this.shortDescription = this.childTask.shortDescription
  }

  public encode(): SquadMemberTaskState {
    return {
      t: "SquadMemberTask",
      s: this.startTime,
      m: this.manuscripts,
      st: {
        c: this.childTask.encode(),
      },
    }
  }

  public static decode(state: SquadMemberTaskState, childTask: CreepTask): SquadMemberTask {
    return new SquadMemberTask(state.s, childTask, state.m)
  }

  public static create(childTask: CreepTask, manuscripts: string[]): SquadMemberTask {
    manuscripts.push(childTask.shortDescription)
    return new SquadMemberTask(Game.time, childTask, manuscripts)
  }

  public taskTargets(creep: V6Creep): TaskTarget[] {
    return this.childTask.taskTargets(creep)
  }

  public run(creep: V6Creep): CreepTaskProgress {
    return this.childTask.run(creep)
  }
}

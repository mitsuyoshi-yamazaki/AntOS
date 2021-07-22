import { ObjectTaskTarget } from "object_task/object_task_target_cache"
import { V6Creep } from "prototype/creep"
import { CreepTask, CreepTaskProgress } from "../creep_task"
import { CreepTaskState } from "../creep_task_state"

export interface TalkTaskState extends CreepTaskState {
  /** type identifier */
  t: "TalkTask"

  /** manuscripts */
  m: string[]

  /** task state */
  st: {
    /** child task state */
    c: CreepTaskState
  }
}

export class TalkTask implements CreepTask {
  public readonly shortDescription: string
  public readonly targets: ObjectTaskTarget[] = []

  private constructor(
    public readonly startTime: number,
    public readonly childTask: CreepTask,
    public readonly manuscripts: string[],
  ) {
    this.shortDescription = this.childTask.shortDescription
  }

  public encode(): TalkTaskState {
    return {
      t: "TalkTask",
      s: this.startTime,
      m: this.manuscripts,
      st: {
        c: this.childTask.encode(),
      },
    }
  }

  public static decode(state: TalkTaskState, childTask: CreepTask): TalkTask {
    return new TalkTask(state.s, childTask, state.m)
  }

  public static create(childTask: CreepTask, manuscripts: string[]): TalkTask {
    manuscripts.push(childTask.shortDescription)
    return new TalkTask(Game.time, childTask, manuscripts)
  }

  public run(creep: V6Creep): CreepTaskProgress {
    const talk = this.manuscripts.shift()
    if (talk != null) {
      creep.say(talk)
    }
    return this.childTask.run(creep)
  }
}

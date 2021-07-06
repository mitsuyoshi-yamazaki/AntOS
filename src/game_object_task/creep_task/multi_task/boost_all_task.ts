import { CreepTask, CreepTaskState } from "game_object_task/creep_task"
import { GameObjectTaskReturnCode } from "game_object_task/game_object_task"
import { BoostTask } from "../boost_task"

export interface BoostAllTaskState extends CreepTaskState {
  /** lab ids */
  i: Id<StructureLab>[]
}

export class BoostAllTask implements CreepTask {
  public readonly shortDescription = "boostall"
  // public get targetId(): Id<StructureLab> {  // TODO:
  //   return this.lab.id
  // }

  public constructor(
    public readonly startTime: number,
    public readonly labs: StructureLab[],
  ) { }

  public encode(): BoostAllTaskState {
    return {
      s: this.startTime,
      t: "BoostAllTask",
      i: this.labs.map(lab => lab.id),
    }
  }

  public static decode(state: BoostAllTaskState): BoostAllTask | null {
    const targets: StructureLab[] = []
    for (const targetId of state.i) {
      const target = Game.getObjectById(targetId)
      if (target == null) {
        return null
      }
      targets.push(target)
    }
    return new BoostAllTask(state.s, targets)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    const lab = this.labs[0]
    if (lab == null) {
      return "finished"
    }
    const result = new BoostTask(this.startTime, lab).run(creep)

    switch (result) {
    case "in progress":
      return "in progress"
    case "finished":
      this.labs.shift()
      return "in progress"
    case "failed":
      return "failed"
    }
  }
}

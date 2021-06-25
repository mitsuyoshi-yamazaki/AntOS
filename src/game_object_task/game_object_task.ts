import { State, Stateful } from "os/infrastructure/state"

export interface GameObjectTaskState extends State {
  /** start time */
  s: number

  /** type identifier */
  t: keyof TaskTypes
}

export type GameObjectTaskReturnCode = "finished" | "in progress" | "failed"

export interface GameObjectTask<T> extends Stateful {
  startTime: number

  run(obj: T): GameObjectTaskReturnCode
}

export interface HarvestTaskState extends GameObjectTaskState {
  /** target id */
  i: Id<Source>
}

export class HarvestTask implements GameObjectTask<Creep> {
  public constructor(
    public readonly startTime: number,
    public readonly source: Source,
  ) { }

  public encode(): HarvestTaskState {
    return {
      s: this.startTime,
      t: "HarvestTask",
      i: this.source.id,
    }
  }

  public static decode(state: HarvestTaskState): HarvestTask | null {
    const source = Game.getObjectById(state.i)
    if (source == null) {
      return null
    }
    return new HarvestTask(state.s, source)
  }

  public run(creep: Creep): GameObjectTaskReturnCode {
    if (creep.store.getFreeCapacity() <= 0) {
      return "finished"
    }

    const result = creep.harvest(this.source)
    switch (result) {
    case OK:
      return "in progress"
    default:
      creep.moveTo(this.source, {reusePath: 15})
      return "in progress"
    }
  }
}

class TaskTypes {
  // force castしてdecode()するため返り値はnullableではない。代わりに呼び出す際はErrorMapperで囲う
  "HarvestTask" = (state: GameObjectTaskState) => HarvestTask.decode(state as HarvestTaskState)
}

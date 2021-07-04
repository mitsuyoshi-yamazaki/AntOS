import { State, Stateful } from "os/infrastructure/state"
import { RoomName } from "prototype/room"

export type TaskRunnerType = Creep | StructureSpawn | StructureTower
export type TaskTargetType = Creep | PowerCreep | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>
export type TaskTargetIdType = Id<TaskTargetType> | RoomName

export class TaskInProgress<T> {
  public readonly taskProgressType = "in progress"
  public constructor(public readonly value: T) { }
}

export class TaskSucceeded<Result> {
  public readonly taskProgressType = "succeeded"
  public constructor(public readonly result: Result) { }
}

export class TaskFailed<Reason> {
  public readonly taskProgressType = "failed"
  public constructor(public readonly reason: Reason) { }
}

export type TaskProgressType<T, S, U> = TaskInProgress<T> | TaskSucceeded<S> | TaskFailed<U>


export interface TaskState extends State {
  /** type identifier */
  t: string

  /** start time */
  s: number
}

export interface Task<O, T, S, U> extends Stateful {
  targetId?: TaskTargetIdType
  startTime: number

  encode(): TaskState
  run(obj: O): TaskProgressType<T, S, U>
}

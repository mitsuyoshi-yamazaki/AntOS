import { State, Stateful } from "os/infrastructure/state"

export type TaskRunnerType = Creep | StructureSpawn | StructureTower
export type TargetType = Creep | AnyStructure | Source | ConstructionSite<BuildableStructureConstant>

export interface GameObjectTaskState extends State {
  /** start time */
  s: number

  /** type identifier */
  t: string
}

export interface GameObjectTaskReturnType<T> {  // TODO:
  value: T
  code: GameObjectTaskReturnCode
}
export type GameObjectTaskReturnCode = "finished" | "in progress" | "failed"

export interface GameObjectTask<T> extends Stateful {
  targetId?: Id<TargetType>
  startTime: number
  taskType: string

  encode(): GameObjectTaskState
  run(obj: T): GameObjectTaskReturnCode
}

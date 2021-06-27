import { StructureSpawnTask, StructureSpawnTaskState, GameObjectTaskReturnCode } from "game_object_task/game_object_task"

export interface SpawnCreepTaskState extends StructureSpawnTaskState {
}

export class SpawnCreepTask implements StructureSpawnTask {
  public readonly taskType = "SpawnCreepTask"
  public readonly shortDescription = "spawn"

  public constructor(
    public readonly startTime: number,
  ) { }

  public encode(): SpawnCreepTaskState {
    return {
      s: this.startTime,
      t: "SpawnCreepTask",
    }
  }

  public static decode(state: SpawnCreepTaskState): SpawnCreepTask | null {
    return new SpawnCreepTask(state.s)
  }

  public addCreepToSpawn(): void {

  }

  public removeCachedSpawn(): void {

  }

  public run(spawn: StructureSpawn): GameObjectTaskReturnCode {
    if (spawn.spawning != null) {
      return "in progress"  // TODO: 優先度が非常に高い場合はキャンセルする
    }
    return "in progress"  // TODO:
  }
}

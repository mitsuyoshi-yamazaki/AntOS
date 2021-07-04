// Worldをimportしない

export interface GameObjectInfo<GameObject> {
  update(obj: GameObject): void
}

export interface SourceRegenerationInfo {
  regenerationTime: number
  energy: number
}

export class SourceInfo implements GameObjectInfo<Source> {
  public readonly regenerationInfo: SourceRegenerationInfo[] = []

  public constructor(
    public readonly id: Id<Source>,
  ) { }

  public update(source: Source): void {
    if (source.ticksToRegeneration !== 2) {
      return
    }
    this.regenerationInfo.unshift({
      regenerationTime: Game.time,
      energy: source.energy,
    })

    if (this.regenerationInfo.length > 10) {
      this.regenerationInfo.pop()
    }
  }
}

export type SpawnSpawningInfoType = "normal" | "canceled"
export interface SpawnSpawningInfo {
  spawningType: SpawnSpawningInfoType
  startTime: number
  finishTime: number
}

export class SpawnInfo implements GameObjectInfo<StructureSpawn> {
  public readonly spawningInfo: SpawnSpawningInfo[] = []

  private startTime: number | null = null

  public constructor(
    public readonly id: Id<StructureSpawn>,
  ) { }

  public update(spawn: StructureSpawn): void {
    const startTime = this.startTime
    const startSpawning = spawn.spawning != null && spawn.spawning.needTime === spawn.spawning.remainingTime
    this.startTime = startSpawning === true ? Game.time : null

    if (startSpawning === true && startTime != null) {
      this.spawningInfo.unshift({
        spawningType: "canceled",
        startTime,
        finishTime: Game.time,
      })
    } else {
      // if (spawn.spawning == null) {

      // }
    }

    if (this.spawningInfo.length > 10) {
      this.spawningInfo.pop()
    }
  }
}

import { decodeObjectivesFrom, Objective, ObjectiveState } from "objective/objective"

export interface SourceEnergyHarvester300ObjectiveState extends ObjectiveState {
}

export class SourceEnergyHarvester300Objective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
  ) { }

  public encode(): SourceEnergyHarvester300ObjectiveState {
    return {
      t: "SourceEnergyHarvester300Objective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
    }
  }

  public static decode(state: SourceEnergyHarvester300ObjectiveState): SourceEnergyHarvester300Objective {
    const children = decodeObjectivesFrom(state.c)
    return new SourceEnergyHarvester300Objective(state.s, children)
  }

  // public run(sources: Source[], creepPool: CreepPool<WorkerCreepSpec>): void {

  // }

  // private work(workers: Creep[], controller: StructureController, sources: Source[], spawn: StructureSpawn): void {
  //   workers.forEach(creep => {
  //     if (creep.spawning) {
  //       return
  //     }
  //     if (creep.task == null) {
  //       this.assignNewTask(creep, sources, spawn, controller)
  //     }
  //     const taskFinished = creep.task?.run(creep) !== "in progress"
  //     if (taskFinished) {
  //       this.assignNewTask(creep, sources, spawn, controller, true) // TODO: already run を Task.run() の返り値から取る
  //     }
  //   })
  // }

  // private assignNewTask(creep: Creep, sources: Source[], spawn: StructureSpawn, controller: StructureController, alreadyRun?: boolean): void {
  //   const noEnergy = (): boolean => {
  //     if (alreadyRun === true) {
  //       return creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity() / 2  // タスクを実行済みである場合、storeが更新されていないため
  //     } else {
  //       return creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0
  //     }
  //   }
  //   if (noEnergy()) {
  //     const source = this.getSourceToAssign(sources)
  //     if (source != null) {
  //       creep.task = new HarvestEnergyTask(Game.time, source)
  //     } else {
  //       creep.task = null
  //     }
  //   } else {
  //     // if (spawn.room.energyAvailable < spawn.room.energyCapacityAvailable) { // TODO: extensionに入れる
  //     if (spawn.room.energyAvailable < 300) {
  //       creep.task = new TransferToStructureTask(Game.time, spawn)
  //     } else {
  //       const constructionSite = this.getConstructionSiteToAssign(controller.room)
  //       if (constructionSite != null) {
  //         creep.task = new BuildTask(Game.time, constructionSite)
  //       } else {
  //         creep.task = new UpgradeControllerTask(Game.time, controller)
  //       }
  //     }
  //   }
  // }
}

export class CreepPool {
  public constructor(
    private spawns: StructureSpawn[], // TODO: spawn以外のcreep取得方法を実装する
    private creeps: Creep[],
  ) { }
}

export class WorkerCreepPool {

}

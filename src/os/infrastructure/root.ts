import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeCreepTask, decodeSpawnTask } from "game_object_task/game_object_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"
import { InfrastructureProcessLauncher } from "./infrastructure_process_launcher"

export class RootProcess {
  private readonly processLauncher = new InfrastructureProcessLauncher()

  public constructor() {
  }

  public setup(): void {
    ErrorMapper.wrapLoop(() => {
      this.processLauncher.launchProcess()
    }, "RootProcess.processLauncher.launchProcess()")()
  }

  public runBeforeTick(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      creep._task = decodeCreepTask(creep)
    }
    for (const spawnName in Game.spawns) {
      const spawn = Game.spawns[spawnName]
      spawn._task = decodeSpawnTask(spawn)
    }
    TaskTargetCache.clearCache()
  }

  public runAfterTick(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      creep.memory.ts = creep.task?.encode() ?? null
    }
    for (const spawnName in Game.spawns) {
      const spawn = Game.spawns[spawnName]
      spawn.memory.ts = spawn.task?.encode() ?? null
    }
  }
}

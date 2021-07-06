import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeCreepTask as decodeV4CreepTask } from "game_object_task/creep_task"
import { decodeSpawnTask } from "game_object_task/spawn_task"
import { isV5CreepMemory, V4CreepMemory } from "prototype/creep"
import { decodeCreepTask } from "task/creep_task/creep_task"
import { World } from "world_info/world_info"
import { ApplicationProcessLauncher } from "./process_launcher/application_process_launcher"
import { InfrastructureProcessLauncher } from "./process_launcher/infrastructure_process_launcher"

export class RootProcess {
  private readonly infrastructureProcessLauncher = new InfrastructureProcessLauncher()
  private readonly applicationProcessLauncher = new ApplicationProcessLauncher()
  private shouldCacheTasks = true

  public constructor() {
  }

  /** デプロイ時、サーバーリセット時に呼び出される */
  public setup(): void {
  }

  public runBeforeTick(): void {
    ErrorMapper.wrapLoop((): void => {
      this.infrastructureProcessLauncher.launchProcess()
    }, "RootProcess.infrastructureProcessLauncher.launchProcess()")()

    ErrorMapper.wrapLoop((): void => {
      World.beforeTick()
    }, "World.beforeTick()")()

    ErrorMapper.wrapLoop((): void => {
      this.applicationProcessLauncher.launchProcess()
    }, "RootProcess.applicationProcessLauncher.launchProcess()")()

    ErrorMapper.wrapLoop((): void => {
      this.restoreTasks()
    }, "RootProcess.restoreTasks()")()
  }

  public runAfterTick(): void {
    ErrorMapper.wrapLoop((): void => {
      World.afterTick()
    }, "World.afterTick()")()

    ErrorMapper.wrapLoop((): void => {
      this.storeTasks()
    }, "RootProcess.storeTasks()")()
  }

  // ---- Private ---- //
  private restoreTasks(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      const task = decodeCreepTask(creep)
      if (this.shouldCacheTasks) {
        if (task != null) {
          creep.task = task
        } else {
          creep.v4Task = decodeV4CreepTask(creep)
        }
      } else {
        if (task != null) {
          creep._task = task
        } else {
          creep._v4Task = decodeV4CreepTask(creep)
        }
      }
    }
    for (const spawnName in Game.spawns) {
      const spawn = Game.spawns[spawnName]
      if (this.shouldCacheTasks) {
        spawn.task = decodeSpawnTask(spawn)
      } else {
        spawn._task = decodeSpawnTask(spawn)
      }
    }
    this.shouldCacheTasks = false
  }

  private storeTasks(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      if (creep.task != null && isV5CreepMemory(creep.memory)) {
        creep.memory.t = creep.task.encode()
      } else {
        if (isV5CreepMemory(creep.memory)) {
          creep.memory.t = null
        } else {
          (creep.memory as V4CreepMemory).ts = creep.v4Task?.encode() ?? null
        }
      }
    }
    for (const spawnName in Game.spawns) {
      const spawn = Game.spawns[spawnName]
      spawn.memory.ts = spawn.task?.encode() ?? null
    }
  }
}

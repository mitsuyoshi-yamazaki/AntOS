import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeCreepTask } from "object_task/creep_task/creep_task_decoder"
import { TaskTargetCache } from "object_task/object_task_target_cache"
import type { ProcessLauncher } from "os/os_process_launcher"
import type { Process } from "process/process"
import { isV5CreepMemory } from "prototype/creep"
import { World } from "world_info/world_info"
import { ApplicationProcessLauncher } from "./process_launcher/application_process_launcher"
import { InfrastructureProcessLauncher } from "./process_launcher/infrastructure_process_launcher"

export class RootProcess {
  private readonly infrastructureProcessLauncher = new InfrastructureProcessLauncher()
  private readonly applicationProcessLauncher = new ApplicationProcessLauncher()

  public constructor() {
  }

  /** デプロイ時、サーバーリセット時に呼び出される */
  public setup(): void {
  }

  public runBeforeTick(processList: Process[], processLauncher: ProcessLauncher): void {
    ErrorMapper.wrapLoop((): void => {
      TaskTargetCache.clearCache()
    }, "TaskTargetCache.clearCache()")()

    ErrorMapper.wrapLoop((): void => {
      this.infrastructureProcessLauncher.launchProcess(processList, processLauncher)
    }, "RootProcess.infrastructureProcessLauncher.launchProcess()")()

    ErrorMapper.wrapLoop((): void => {
      World.beforeTick()
    }, "World.beforeTick()")()

    ErrorMapper.wrapLoop((): void => {
      this.applicationProcessLauncher.launchProcess(processList, processLauncher)
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
      creep.task = task
    }
  }

  private storeTasks(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      if (!isV5CreepMemory(creep.memory)) {
        continue
      }
      creep.memory.t = creep.task?.encode() ?? null
    }
  }
}

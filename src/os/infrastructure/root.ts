import { ErrorMapper } from "error_mapper/ErrorMapper"
import { isV5CreepMemory } from "prototype/creep"
import { decodeCreepTask } from "object_task/creep_task/creep_task"
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
        creep.task = task
      } else {
        creep._task = task
      }
    }
    this.shouldCacheTasks = false
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

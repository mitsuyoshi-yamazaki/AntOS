import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeCreepTask as v5DecodeCreepTask } from "v5_object_task/creep_task/creep_task_decoder"
import { TaskTargetCache as V5TaskTargetCache } from "v5_object_task/object_task_target_cache"
import type { ProcessLauncher } from "os/os_process_launcher"
import type { Process } from "process/process"
import { isV5CreepMemory, isV6Creep } from "prototype/creep"
import { RoomResources } from "room_resource/room_resources"
import { World } from "world_info/world_info"
import { ApplicationProcessLauncher } from "./process_launcher/application_process_launcher"
import { InfrastructureProcessLauncher } from "./process_launcher/infrastructure_process_launcher"
import { decodeCreepTask } from "object_task/creep_task/creep_task_decoder"
import { TaskTargetCache } from "object_task/object_task_target_cache"
import { ResourceManager } from "utility/resource_manager"

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
      V5TaskTargetCache.clearCache()
    }, "V5TaskTargetCache.clearCache()")()

    ErrorMapper.wrapLoop((): void => {
      TaskTargetCache.clearCache()
    }, "TaskTargetCache.clearCache()")()

    ErrorMapper.wrapLoop((): void => {
      ResourceManager.beforeTick()
    }, "ResourceManager.beforeTick()")()

    ErrorMapper.wrapLoop((): void => {
      this.infrastructureProcessLauncher.launchProcess(processList, processLauncher)
    }, "RootProcess.infrastructureProcessLauncher.launchProcess()")()

    ErrorMapper.wrapLoop((): void => {
      RoomResources.beforeTick()
    }, "RoomResources.beforeTick()")()

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
      RoomResources.afterTick()
    }, "RoomResources.afterTick()")()

    ErrorMapper.wrapLoop((): void => {
      this.storeTasks()
    }, "RootProcess.storeTasks()")()

    ErrorMapper.wrapLoop((): void => {
      ResourceManager.afterTick()
    }, "ResourceManager.afterTick()")()
  }

  // ---- Private ---- //
  private restoreTasks(): void {
    Object.entries(Game.creeps).forEach(([, creep]) => {
      if (isV6Creep(creep)) {
        const task = decodeCreepTask(creep)
        creep.task = task
        if (task != null) {
          TaskTargetCache.didAssignTask(creep.id, task.taskTargets(creep))
        }
      }
      creep.v5task = v5DecodeCreepTask(creep)
    })
  }

  private storeTasks(): void {
    Object.entries(Game.creeps).forEach(([, creep]) => {
      if (isV6Creep(creep)) {
        creep.memory.t = creep.task?.encode() ?? null
      } else if (isV5CreepMemory(creep.memory)) {
        creep.memory.t = creep.v5task?.encode() ?? null
      }
    })
  }
}

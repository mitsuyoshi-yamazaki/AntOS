import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeCreepTask as v5DecodeCreepTask } from "v5_object_task/creep_task/creep_task_decoder"
import { TaskTargetCache as V5TaskTargetCache } from "v5_object_task/object_task_target_cache"
import type { ProcessLauncher } from "os/os_process_launcher"
import type { Process } from "process/process"
import { isV5CreepMemory, isV6Creep } from "prototype/creep"
import { RoomResources } from "room_resource/room_resources"
import { World } from "world_info/world_info"
import { ApplicationProcessLauncher } from "./process_launcher/application_process_launcher"
import { decodeCreepTask } from "object_task/creep_task/creep_task_decoder"
import { TaskTargetCache } from "object_task/object_task_target_cache"
import { ResourceManager } from "utility/resource_manager"
import { Logger } from "./logger"
import { ProcessRequestStore } from "os/process_request_store"
import { GameMap } from "game/game_map"
import { GameRecord } from "game/game_record"
import { Season4ObserverManager } from "process/temporary/season4_observer_manager"
import { emptyPositionCache } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { UniqueId } from "utility/unique_id"
import { SwcAllyRequest } from "script/swc_ally_request"
import { IntegratedAttack } from "../../../submodules/private/attack/integrated_attack/integrated_attack"
// import { InterShardMemoryWatcher } from "utility/inter_shard_memory"

export class RootProcess {
  private readonly applicationProcessLauncher = new ApplicationProcessLauncher()
  private readonly logger = new Logger()

  public constructor() {
  }

  /** デプロイ時、サーバーリセット時に呼び出される */
  public setup(): void {
    ErrorMapper.wrapLoop((): void => {
      UniqueId.load()
    }, "UniqueId.load()")()

    ErrorMapper.wrapLoop((): void => {
      IntegratedAttack.load()
    }, "IntegratedAttack.load()")()
  }

  public runBeforeTick(processList: Process[], processLauncher: ProcessLauncher): void {
    ErrorMapper.wrapLoop((): void => {
      UniqueId.beforeTick()
    }, "UniqueId.beforeTick()")()

    // ErrorMapper.wrapLoop((): void => {
    //   InterShardMemoryWatcher?.startOfTick()
    // }, "InterShardMemoryWatcher.startOfTick()")()

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

    ErrorMapper.wrapLoop((): void => {
      ProcessRequestStore.beforeTick()
    }, "ProcessRequestStore.beforeTick()")()

    ErrorMapper.wrapLoop((): void => {
      GameMap.beforeTick()
    }, "GameMap.beforeTick()")()

    ErrorMapper.wrapLoop((): void => {
      GameRecord.beforeTick()
    }, "GameRecord.beforeTick()")()

    ErrorMapper.wrapLoop((): void => {
      Season4ObserverManager.beforeTick()
    }, "Season4ObserverManager.beforeTick()")()

    ErrorMapper.wrapLoop((): void => {
      emptyPositionCache.beforeTick()
    }, "emptyPositionCache.beforeTick()")()

    if (Memory.os.enabledDrivers.swcAllyRequest === true) {
      ErrorMapper.wrapLoop((): void => {
        SwcAllyRequest.beforeTick()
      }, "SwcAllyRequest.beforeTick()")()
    }

    ErrorMapper.wrapLoop((): void => {
      IntegratedAttack.beforeTick()
    }, "IntegratedAttack.beforeTick()")()
  }

  public runAfterTick(): void {
    ErrorMapper.wrapLoop((): void => {
      this.logger.run()
    }, "Logger.run()")()

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

    ErrorMapper.wrapLoop((): void => {
      ProcessRequestStore.afterTick()
    }, "ProcessRequestStore.afterTick()")()

    ErrorMapper.wrapLoop((): void => {
      GameMap.afterTick()
    }, "GameMap.afterTick()")()

    ErrorMapper.wrapLoop((): void => {
      GameRecord.afterTick()
    }, "GameRecord.afterTick()")()

    ErrorMapper.wrapLoop((): void => {
      Season4ObserverManager.afterTick()
    }, "Season4ObserverManager.afterTick()")()

    ErrorMapper.wrapLoop((): void => {
      emptyPositionCache.afterTick()
    }, "emptyPositionCache.afterTick()")()

    // ErrorMapper.wrapLoop((): void => {
    //   InterShardMemoryWatcher?.endOfTick()
    // }, "InterShardMemoryWatcher.endOfTick()")()

    ErrorMapper.wrapLoop((): void => {
      UniqueId.afterTick()
    }, "UniqueId.afterTick()")()

    if (Memory.os.enabledDrivers.swcAllyRequest === true) {
      ErrorMapper.wrapLoop((): void => {
        SwcAllyRequest.afterTick()
      }, "SwcAllyRequest.afterTick()")()
    }

    ErrorMapper.wrapLoop((): void => {
      IntegratedAttack.afterTick()
    }, "IntegratedAttack.afterTick()")()
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

  private storeTasks(): void {  // ※ Creepオブジェクトは永続化しないため、Game.serialization.canSkip()の値に関わらずMemoryに入れる必要がある
    Object.entries(Game.creeps).forEach(([, creep]) => {
      if (isV6Creep(creep)) {
        creep.memory.t = creep.task?.encode() ?? null
      } else if (isV5CreepMemory(creep.memory)) {
        creep.memory.t = creep.v5task?.encode() ?? null
      }
    })
  }
}

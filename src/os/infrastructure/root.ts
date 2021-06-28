import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeCreepTask } from "game_object_task/creep_task"
import { decodeSpawnTask } from "game_object_task/spawn_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"
import { decodeTowerTask } from "game_object_task/tower_task"
import { OwnedRoomObjectCache } from "objective/room_keeper/owned_room_object_cache"
import { ApplicationProcessLauncher } from "./application_process_launcher"
import { InfrastructureProcessLauncher } from "./infrastructure_process_launcher"

export class RootProcess {
  private readonly infrastructureProcessLauncher = new InfrastructureProcessLauncher()
  private readonly applicationProcessLauncher = new ApplicationProcessLauncher()

  public constructor() {
  }

  public setup(): void {
    ErrorMapper.wrapLoop(() => {
      this.infrastructureProcessLauncher.launchProcess()
    }, "RootProcess.infrastructureProcessLauncher.launchProcess()")()

    ErrorMapper.wrapLoop(() => {
      this.applicationProcessLauncher.launchProcess()
    }, "RootProcess.applicationProcessLauncher.launchProcess()")()
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
    // for (const towerId in Memory.towers) { // TODO:
    //   const tower = Game.getObjectById(towerId)
    //   if (!(tower instanceof StructureTower)) {
    //     continue
    //   }
    //   tower._task = decodeTowerTask(towerId as Id<StructureTower>)
    // }
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
    // for () { // TODO:

    // }

    TaskTargetCache.clearCache()
    OwnedRoomObjectCache.clearCache()
  }
}

import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeCreepTask } from "game_object_task/creep_task"
import { decodeSpawnTask } from "game_object_task/spawn_task"
import { decodeTowerTask } from "game_object_task/tower_task"
import { OwnedRoomObjectCache } from "objective/room_keeper/owned_room_object_cache"
import { Migration } from "utility/migration"
import { ApplicationProcessLauncher } from "./application_process_launcher"
import { InfrastructureProcessLauncher } from "./infrastructure_process_launcher"

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
    const ownedRooms = this.getOwnedRooms()

    ErrorMapper.wrapLoop((): void => {
      this.createOwnedRoomObjectsCache(ownedRooms)
    }, "RootProcess.createOwnedRoomObjectsCache()")()

    ErrorMapper.wrapLoop((): void => {
      this.infrastructureProcessLauncher.launchProcess()
    }, "RootProcess.infrastructureProcessLauncher.launchProcess()")()

    ErrorMapper.wrapLoop((): void => {
      this.applicationProcessLauncher.launchProcess()
    }, "RootProcess.applicationProcessLauncher.launchProcess()")()

    ErrorMapper.wrapLoop((): void => {
      this.restoreTasks()
    }, "RootProcess.restoreTasks()")()
  }

  public runAfterTick(): void {
    this.storeTasks()

    OwnedRoomObjectCache.clearCache()
  }

  // ---- Private ---- //
  private createOwnedRoomObjectsCache(ownedRooms: Room[]): void {
    ownedRooms.forEach(room => {
      OwnedRoomObjectCache.createCache(room)
    })
  }

  private restoreTasks(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      if (this.shouldCacheTasks) {
        creep.task = decodeCreepTask(creep)
      } else {
        creep._task = decodeCreepTask(creep)
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
    this.getAllTowers().forEach(tower => {
      if (this.shouldCacheTasks) {
        tower.task = decodeTowerTask(tower.id as Id<StructureTower>)
      } else {
        tower._task = decodeTowerTask(tower.id as Id<StructureTower>)
      }
    })
    this.shouldCacheTasks = false
  }

  private storeTasks(): void {
    for (const creepName in Game.creeps) {
      const creep = Game.creeps[creepName]
      creep.memory.ts = creep.task?.encode() ?? null
    }
    for (const spawnName in Game.spawns) {
      const spawn = Game.spawns[spawnName]
      spawn.memory.ts = spawn.task?.encode() ?? null
    }
    this.getAllTowers().forEach(tower => {
      if (Memory.towers[tower.id] == null) {
        Memory.towers[tower.id] = {
          ts: tower.task?.encode() ?? null
        }
      } else {
        Memory.towers[tower.id].ts = tower.task?.encode() ?? null
      }
    })
  }

  private getOwnedRooms(): Room[] {
    const ownedRooms: Room[] = []

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName]
      if (room.controller == null) {
        continue
      }
      if (room.controller.my !== true) {
        continue
      }
      if (Migration.oldRoomNames.includes(roomName) === true) {
        continue
      }
      ownedRooms.push(room)
    }
    return ownedRooms
  }

  private getAllTowers(): StructureTower[] {
    return OwnedRoomObjectCache.allRoomObjects().reduce((result, current) => {
      return result.concat(current.activeStructures.towers)
    }, [] as StructureTower[])
  }
}

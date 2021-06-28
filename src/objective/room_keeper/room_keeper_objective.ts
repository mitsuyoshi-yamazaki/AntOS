import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveState } from "objective/objective"
import { SpawnCreepObjective } from "objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"
import { RoomName } from "prototype/room"
import { EnergyChargeableStructure } from "prototype/room_object"
import { roomLink } from "utility/log"
import { LowLevelWorkerObjective } from "./low_level_worker_objective"

interface RoomKeeperObjectiveRoomInfo { // TODO:
  sources: Source[]
  constructionSites: ConstructionSite<BuildableStructureConstant>[] // TODO: 優先順位づけ等
  activeStructures: {
    spawns: StructureSpawn[]
    extensions: StructureExtension[]
    towers: StructureTower[]

    chargeableStructures: EnergyChargeableStructure[]
  }
}

export interface RoomKeeperObjectiveEvents {
  spawnedCreeps: number
  canceledCreepNames: CreepName[]
  status: string
}

type RoomKeeperObjectiveProgressType = ObjectiveInProgress<RoomKeeperObjectiveEvents> | ObjectiveFailed<string>

export interface RoomKeeperObjectiveState extends ObjectiveState {
  /** room name */
  r: RoomName,
}

/**
 * - successしない
 */
export class RoomKeeperObjective implements Objective {
  private readonly spawnCreepObjective: SpawnCreepObjective
  private readonly workerObjective: LowLevelWorkerObjective // TODO: RCLごとに実行するobjectiveを切り替える

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public readonly roomName: RoomName,
  ) {
    let spawnCreepObjective: SpawnCreepObjective | null = null
    let workerObjective: LowLevelWorkerObjective | null = null
    children.forEach(child => {
      if (child instanceof SpawnCreepObjective) {
        spawnCreepObjective = child
        return
      }
      if (child instanceof LowLevelWorkerObjective) {
        workerObjective = child
        return
      }
    })
    this.spawnCreepObjective = spawnCreepObjective ?? new SpawnCreepObjective(Game.time, [], [])
    this.workerObjective = ((): LowLevelWorkerObjective => {
      if (workerObjective != null) {
        return workerObjective
      }
      return new LowLevelWorkerObjective(Game.time, [], [], [])
    })()
  }

  public encode(): RoomKeeperObjectiveState {
    return {
      t: "RoomKeeperObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      r: this.roomName,
    }
  }

  public static decode(state: RoomKeeperObjectiveState): RoomKeeperObjective {
    const children = decodeObjectivesFrom(state.c)
    return new RoomKeeperObjective(state.s, children, state.r)
  }

  public progress(): RoomKeeperObjectiveProgressType {
    const room = Game.rooms[this.roomName]
    if (room == null) {
      return new ObjectiveFailed(`${roomLink(this.roomName)} is not visible`)
    }
    if (room.controller == null || room.controller.my !== true) {
      return new ObjectiveFailed(`${roomLink(this.roomName)} is not owned by me`)
    }

    const controller = room.controller
    const sources = room.find(FIND_SOURCES)
    const spawns: StructureSpawn[] = []
    const extensions: StructureExtension[] = []
    const towers: StructureTower[] = []
    const chargeableStructures: EnergyChargeableStructure[] = []

    const myStructures = room.find(FIND_MY_STRUCTURES)
    myStructures.forEach(structure => {
      if (structure.isActive() !== true) {
        return
      }
      switch (structure.structureType) {
      case STRUCTURE_SPAWN:
        spawns.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_EXTENSION:
        extensions.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      case STRUCTURE_TOWER:
        towers.push(structure)
        if (structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
          chargeableStructures.push(structure)
        }
        break
      default:
        break // TODO: 全て網羅する
      }
    })

    let status = ""
    let workerStatus = null as string | null

    ErrorMapper.wrapLoop((): void => {
      workerStatus = this.runWorker(sources, chargeableStructures, controller)
    }, "RoomKeeperObjective.runWorker()")()
    status += workerStatus == null ? `${this.workerObjective.constructor.name} failed execution` : workerStatus

    let spawnResult = null as [number, CreepName[]] | null

    ErrorMapper.wrapLoop((): void => {
      spawnResult = this.runCreepSpawn(room, spawns)
    }, "RoomKeeperObjective.runCreepSpawn()")()

    const [spawnedCreeps, canceledCreepNames] = spawnResult ?? [0, []]

    const event: RoomKeeperObjectiveEvents = {
      spawnedCreeps,
      canceledCreepNames,
      status,
    }

    return new ObjectiveInProgress(event)
  }

  // ---- Private ---- //
  private runWorker(
    sources: Source[],
    chargeableStructures: EnergyChargeableStructure[],
    controller: StructureController,
  ): string {

    const workerProgress = this.workerObjective.progress(sources, chargeableStructures, controller, this.spawnCreepObjective)
    return ((): string => {
      switch (workerProgress.objectProgressType) {
      case "in progress": {
        const deadsDescription = workerProgress.value.diedWorkers > 0 ? `, ${workerProgress.value.diedWorkers} died` : ""
        return `${workerProgress.value.workers} workers, ${workerProgress.value.queueingWorkers} in queue${deadsDescription}`
      }
      case "failed":
        return workerProgress.reason
      }
    })()
  }

  private runCreepSpawn(room: Room, spawns: StructureSpawn[]): [number, CreepName[]] {
    const spawnCreepProgress = this.spawnCreepObjective.progress(room, spawns)
    let spawnedCreeps = 0
    const canceledCreepNames: CreepName[] = []

    switch (spawnCreepProgress.objectProgressType) {
    case "in progress":
      if (spawnCreepProgress.value.spawnedCreepNames.length > 0) {
        this.workerObjective.didSpawnCreep(spawnCreepProgress.value.spawnedCreepNames)
        spawnedCreeps = spawnCreepProgress.value.spawnedCreepNames.length
      }
      if (spawnCreepProgress.value.canceledCreepNames.length > 0) {
        this.workerObjective.didCancelCreep(spawnCreepProgress.value.canceledCreepNames)
        canceledCreepNames.push(...spawnCreepProgress.value.canceledCreepNames)
      }
      break

    case "failed":
      if (spawnCreepProgress.reason.queuedCreepNames.length > 0) {
        this.workerObjective.didCancelCreep(spawnCreepProgress.reason.queuedCreepNames)
        canceledCreepNames.push(...spawnCreepProgress.reason.queuedCreepNames)
      }
      break
    }

    return [spawnedCreeps, canceledCreepNames]
  }
}

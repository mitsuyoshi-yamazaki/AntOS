import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "objective/objective"
import { generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"
import { UpgradeControllerTask } from "game_object_task/creep_task/upgrade_controller_task"
import { TransferToStructureTask } from "game_object_task/creep_task/transfer_to_structure_task"
import { CreepName } from "prototype/creep"
import { HarvestEnergyTask } from "game_object_task/creep_task/harvest_energy_task"
import { BuildTask } from "game_object_task/creep_task/build_task"
import { TaskTargetCache } from "game_object_task/task_target_cache"

const numberOfWorkersEachSource = 8

interface UpgradeL3ControllerObjectiveSucceededState {
  controller: StructureController
  creeps: Creep[]
}

interface UpgradeL3ControllerObjectiveFailedState {
  reason: string
  creeps: Creep[]
}

type UpgradeL3ControllerObjectiveProgressType = ObjectiveProgressType<string, UpgradeL3ControllerObjectiveSucceededState, UpgradeL3ControllerObjectiveFailedState>

export interface UpgradeL3ControllerObjectiveState extends ObjectiveState {
  /** creep IDs */
  cr: {
    /** worker name */
    w: CreepName[]

    /** harvester name */
    hv: CreepName[]

    /** hauler name */
    hl: CreepName[]
  }

  /** source IDs */
  si: Id<Source>[]

  /** working state */
  w: {
    /** building construction site */
    c: Id<ConstructionSite<BuildableStructureConstant>> | null
  }
}

export interface UpgradeL3ControllerObjectiveWorkingInfo {
  constructionSiteId: Id<ConstructionSite<BuildableStructureConstant>> | null
}

export class UpgradeL3ControllerObjective implements Objective {
  private baseWorkerBodies: BodyPartConstant[] = [WORK, CARRY, MOVE]
  private baseWorkerSpawnEnergy = 100 + 50 + 50

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private workerNames: CreepName[],
    private harvesterNames: CreepName[],
    private haulerNames: CreepName[],
    private sourceIds: Id<Source>[],
    private workingInfo: UpgradeL3ControllerObjectiveWorkingInfo,
  ) {
  }

  public encode(): UpgradeL3ControllerObjectiveState {
    return {
      t: "UpgradeL3ControllerObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      cr: {
        w: this.workerNames,
        hv: this.harvesterNames,
        hl: this.haulerNames,
      },
      si: this.sourceIds,
      w: {
        c: this.workingInfo.constructionSiteId,
      },
    }
  }

  public static decode(state: UpgradeL3ControllerObjectiveState): UpgradeL3ControllerObjective {
    const children = decodeObjectivesFrom(state.c)
    const workingInfo: UpgradeL3ControllerObjectiveWorkingInfo = {
      constructionSiteId: state.w.c
    }
    return new UpgradeL3ControllerObjective(state.s, children, state.cr.w, state.cr.hv, state.cr.hl, state.si, workingInfo)
  }

  public progress(spawn: StructureSpawn, controller: StructureController): UpgradeL3ControllerObjectiveProgressType {
    let progress: UpgradeL3ControllerObjectiveProgressType | null = null
    ErrorMapper.wrapLoop((): void => {

      const workers: Creep[] = []
      const aliveWorkerNames: string[] = []
      this.workerNames.forEach(workerName => {
        const creep = Game.creeps[workerName]
        if (creep == null) {
          return
        }
        workers.push(creep)
        aliveWorkerNames.push(workerName)
      })
      this.workerNames = aliveWorkerNames

      // if (controller.level >= 3) { // FixMe:
      //   progress = new ObjectiveSucceeded({controller, creeps: workers})
      // }

      const sources: Source[] = this.sourceIds.reduce((result, sourceId) => {
        const source = Game.getObjectById(sourceId)
        if (source != null) {
          result.push(source)
        }
        return result
      }, [] as Source[])

      const hasEnoughWorkers = workers.length >= numberOfWorkersEachSource * sources.length
      const canSpawn = spawn.room.energyAvailable >= this.baseWorkerSpawnEnergy

      if (hasEnoughWorkers !== true && spawn.spawning == null && canSpawn) {
        this.spawnWorker(spawn, this.getSourceToAssign(sources))
      }

      this.work(workers, controller, sources, spawn)
      progress = new ObjectiveInProgress(`${workers.length} working`)
    }, "UpgradeL3ControllerObjective.progress()")()

    if (progress != null) {
      return progress
    }
    return new ObjectiveFailed({ reason: "Program bug", creeps: [] })
  }

  // ---- Work ---- //
  private work(workers: Creep[], controller: StructureController, sources: Source[], spawn: StructureSpawn): void {
    workers.forEach(creep => {
      if (creep.spawning) {
        return
      }
      if (creep.task == null) {
        this.assignNewTask(creep, workers, sources, spawn, controller)
      }
      const taskFinished = creep.task?.run(creep) !== "in progress"
      if (taskFinished) {
        this.assignNewTask(creep, workers, sources, spawn, controller, true)
      }
    })
  }

  private assignNewTask(creep: Creep, workers: Creep[], sources: Source[], spawn: StructureSpawn, controller: StructureController, alreadyRun?: boolean): void {
    const noEnergy = (): boolean => {
      if (alreadyRun === true) {
        return creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity() / 2  // タスクを実行済みである場合、storeが更新されていないため
      } else {
        return creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0
      }
    }
    if (noEnergy()) {
      const source = this.getSourceToAssign(sources)
      if (source != null) {
        creep.task = new HarvestEnergyTask(Game.time, source)
      } else {
        creep.task = null
      }
    } else {
      // if (spawn.room.energyAvailable < spawn.room.energyCapacityAvailable) { // TODO: extensionに入れる
      if (spawn.room.energyAvailable < 300) {
        creep.task = new TransferToStructureTask(Game.time, spawn)
      } else {
        const constructionSite = this.getConstructionSiteToAssign(controller.room)
        if (constructionSite != null) {
          creep.task = new BuildTask(Game.time, constructionSite)
        } else {
          creep.task = new UpgradeControllerTask(Game.time, controller)
        }
      }
    }
  }

  private getSourceToAssign(sources: Source[]): Source | null {
    return sources.reduce((lhs, rhs) => {
      return lhs.targetedBy.length < rhs.targetedBy.length ? lhs : rhs
    })
  }

  private getConstructionSiteToAssign(room: Room): ConstructionSite<BuildableStructureConstant> | null {
    if (this.workingInfo.constructionSiteId) {
      const constructionSite = Game.getObjectById(this.workingInfo.constructionSiteId)
      if (constructionSite != null) {
        return constructionSite
      }
    }

    const constructionSite = room.find(FIND_CONSTRUCTION_SITES)[0]
    this.workingInfo.constructionSiteId = constructionSite?.id
    return constructionSite
  }

  // ---- Spawn ---- //
  private spawnWorker(spawn: StructureSpawn, targetSource: Source | null): void {
    const time = Game.time
    const initialTask = targetSource != null ? new HarvestEnergyTask(time, targetSource) : null
    const name = generateUniqueId("belgian_waffle")
    const memory: CreepMemory = {
      ts: initialTask?.encode() ?? null,
      squad_name: "",
      status: CreepStatus.NONE,
      type: CreepType.WORKER,
      birth_time: time,
      should_notify_attack: false,
      let_thy_die: true,
    }
    const result = spawn.spawnCreep(this.baseWorkerBodies, name, { memory: memory })
    switch (result) {
    case OK:
      this.workerNames.push(name)
      break
    default:
      PrimitiveLogger.log(`UpgradeL3ControllerObjective spawn ${spawn.id} failed with error: ${result}`)
      break
    }
  }
}

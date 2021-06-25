import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "objective/objective"
import { generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"
import { HarvestTask } from "game_object_task/creep_task/harvest_task"
import { UpgradeControllerTask } from "game_object_task/creep_task/upgrade_controller_task"

const numberOfWorkersEachSource = 10

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
    w: string[]
  }

  /** source IDs */
  si: Id<Source>[]
}

export class UpgradeL3ControllerObjective implements Objective {
  private baseWorkerBodies: BodyPartConstant[] = [WORK, CARRY, MOVE]
  private baseWorkerSpawnEnergy = 100 + 50 + 50
  private sourceAssignsCache = new Map<Id<Source>, number>()

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private workerNames: string[],
    private sourceIds: Id<Source>[],
  ) {

  }

  public encode(): UpgradeL3ControllerObjectiveState {
    return {
      t: "UpgradeL3ControllerObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      cr: {
        w: this.workerNames,
      },
      si: this.sourceIds,
    }
  }

  public static decode(state: UpgradeL3ControllerObjectiveState): UpgradeL3ControllerObjective {
    const children = decodeObjectivesFrom(state.c)
    return new UpgradeL3ControllerObjective(state.s, children, state.cr.w, state.si)
  }

  public progress(spawn: StructureSpawn, controller: StructureController): UpgradeL3ControllerObjectiveProgressType {
    let progress: UpgradeL3ControllerObjectiveProgressType | null = null
    ErrorMapper.wrapLoop((): void => {

      this.sourceAssignsCache.clear()

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

      if (workers.length < numberOfWorkersEachSource && spawn.spawning == null && spawn.store.getUsedCapacity(RESOURCE_ENERGY) >= this.baseWorkerSpawnEnergy) {
        const source = this.getSourceToAssign(workers, sources)
        if (source != null) {
          this.spawnWorker(spawn, source)
        }
      }

      this.work(workers, controller, sources)
      progress = new ObjectiveInProgress(`${workers.length} working`)
    }, "UpgradeL3ControllerObjective.progress()")()

    if (progress != null) {
      return progress
    }
    return new ObjectiveFailed({ reason: "Program bug", creeps: [] })
  }

  // ---- Work ---- //
  private work(workers: Creep[], controller: StructureController, sources: Source[]): void {
    workers.forEach(creep => {
      if (creep.spawning) {
        return
      }
      const isIdle = creep.task == null || creep.task.run(creep) !== "in progress"
      if (isIdle !== true) {
        return
      }
      switch (creep.task?.taskType) {
      case "HarvestTask": {
        const source = this.getSourceToAssign(workers, sources)
        if (source != null) {
          creep.task = new HarvestTask(Game.time, source)
        } else {
          creep.task = null
        }
        break
      }
      case "UpgradeControllerTask":
      default:
        creep.task = new UpgradeControllerTask(Game.time, controller)
        break

        // TODO: メモリに入れる
      }
    })
  }

  private getSourceToAssign(workers: Creep[], sources: Source[]): Source | null {
    if (this.sourceAssignsCache.size <= 0) {
      sources.forEach(source => this.sourceAssignsCache.set(source.id, 0))

      for (const creep of workers) {
        if (!(creep.task instanceof HarvestTask)) {
          continue
        }
        const sourceId = creep.task.source.id
        const count = this.sourceAssignsCache.get(sourceId) ?? 0
        this.sourceAssignsCache.set(sourceId, count + 1)
      }
    }

    const sourceId = Array.from(this.sourceAssignsCache.entries()).reduce((result: [Id<Source>, number] | null, current: [Id<Source>, number]) => {
      if (result == null) {
        return current
      }
      return current[1] < result[1] ? current : result
    }, null)

    if (sourceId == null) {
      return null
    }

    return Game.getObjectById(sourceId[0])
  }

  // ---- Spawn ---- //
  private spawnWorker(spawn: StructureSpawn, targetSource: Source): void {
    const time = Game.time
    const initialTask = new HarvestTask(time, targetSource)
    const name = generateUniqueId("belgian_waffle")
    const memory: CreepMemory = {
      ts: initialTask.encode(),
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

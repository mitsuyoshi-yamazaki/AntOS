import { ErrorMapper } from "error_mapper/ErrorMapper"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "task/objective"
import { generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"

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

interface UpgradeL3ControllerObjectiveWorkerMemory extends CreepMemory {
  sourceId: Id<Source>
}

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

      const sources: Source[] = this.sourceIds.reduce((result, sourceId) => {
        const source = Game.getObjectById(sourceId)
        if (source != null) {
          result.push(source)
        }
        return result
      }, [] as Source[])

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

      if (controller.level >= 3) {
        progress = new ObjectiveSucceeded({controller, creeps: workers})
      }

      if (workers.length < numberOfWorkersEachSource && spawn.spawning == null && spawn.store.getUsedCapacity(RESOURCE_ENERGY) >= this.baseWorkerSpawnEnergy) {
        const sourceId = this.targetSourceId(workers, this.sourceIds)
        if (sourceId) {
          this.spawnWorker(spawn, sourceId)
        }
      }

      this.work(workers, spawn)
      progress = new ObjectiveInProgress(`${workers.length} working`)
    }, "UpgradeL3ControllerObjective.progress()")()

    if (progress != null) {
      return progress
    }
    return new ObjectiveFailed({ reason: "Program bug", creeps: [] })
  }

  // ---- Work ---- //
  private work(workers: Creep[], spawn: StructureSpawn): void {
    workers.forEach(creep => {
      if (creep.spawning) {
        return
      }
      const transfer = () => this.transfer(creep, spawn)
      const harvest = () => this.harvest(creep)

      switch (creep.memory.status) {
      case CreepStatus.HARVEST:
        if (creep.carry[RESOURCE_ENERGY] >= creep.carryCapacity) {
          creep.memory.status = CreepStatus.CHARGE
          transfer()
          break
        }
        harvest()
        break
      case CreepStatus.CHARGE:
        if (creep.carry[RESOURCE_ENERGY] <= 0) {
          creep.memory.status = CreepStatus.HARVEST
          harvest()
          break
        }
        transfer()
        break
      default:
        creep.memory.status = CreepStatus.HARVEST
      }
    })
  }

  private harvest(creep: Creep): void {
    const sourceId = (creep.memory as UpgradeL3ControllerObjectiveWorkerMemory).sourceId
    const source = Game.getObjectById(sourceId) ?? creep.pos.findClosestByPath(FIND_SOURCES)
    if (source == null) {
      return
    }
    (creep.memory as UpgradeL3ControllerObjectiveWorkerMemory).sourceId = source.id
    if (creep.harvest(source) !== OK) {
      creep.moveTo(source, { reusePath: 15 })
    }
  }

  private transfer(creep: Creep, spawn: StructureSpawn): void {
    if (creep.transfer(spawn, RESOURCE_ENERGY) !== OK) {
      creep.moveTo(spawn)
    }
  }

  // ---- Spawn ---- //
  private targetSourceId(workers: Creep[], sourceIds: Id<Source>[]): Id<Source> | null {
    // const targets: Id<Source>
    // workers.forEach()
    return sourceIds[0]
  }

  private spawnWorker(spawn: StructureSpawn, targetSourceId: Id<Source>): void {
    const name = generateUniqueId("belgian_waffle")
    const memory: UpgradeL3ControllerObjectiveWorkerMemory = {
      sourceId: targetSourceId,
      squad_name: "",
      status: CreepStatus.NONE,
      type: CreepType.WORKER,
      birth_time: Game.time,
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

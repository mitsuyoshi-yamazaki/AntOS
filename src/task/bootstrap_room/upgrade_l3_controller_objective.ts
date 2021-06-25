import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveProgressType, ObjectiveState, ObjectiveSucceeded } from "task/objective"
import { generateUniqueId } from "utility/unique_id"

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
    /** worker */
    w: string[]
  }
}

export class UpgradeL3ControllerObjective implements Objective {
  private workerBodies: BodyPartConstant[] = [WORK, CARRY, MOVE]
  private workerSpawnEnergy = 100 + 50 + 50

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private workerIds: string[],
  ) {

  }

  public encode(): UpgradeL3ControllerObjectiveState {
    return {
      t: "UpgradeL3ControllerObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      cr: {
        w: this.workerIds,
      }
    }
  }

  public static decode(state: UpgradeL3ControllerObjectiveState): UpgradeL3ControllerObjective {
    const children = decodeObjectivesFrom(state.c)
    return new UpgradeL3ControllerObjective(state.s, children, state.cr.w)
  }

  public progress(spawn: StructureSpawn, controller: StructureController): UpgradeL3ControllerObjectiveProgressType {
    const progress: UpgradeL3ControllerObjectiveProgressType | null = null
    ErrorMapper.wrapLoop(() => {

      const workers: Creep[] = []
      const aliveWorkerIds: string[] = []
      this.workerIds.forEach(workerId => {
        const creep = Game.getObjectById(workerId)
        if (creep instanceof Creep) {
          workers.push(creep)
          aliveWorkerIds.push(workerId)
        }
      })
      this.workerIds = aliveWorkerIds

      if (controller.level >= 3) {
        return new ObjectiveSucceeded({controller, creeps: workers})
      }

      if (spawn.spawning == null && spawn.energy >= this.workerSpawnEnergy) {
        this.spawnWorker(spawn)
      }

      return new ObjectiveFailed({ reason: "Not implemented yet", creeps: [] })
    }, "UpgradeL3ControllerObjective.progress()")()

    if (progress != null) {
      return progress
    }
    return new ObjectiveFailed({ reason: "Program bug", creeps: [] })
  }

  private spawnWorker(spawn: StructureSpawn): string {
    const name = generateUniqueId("belgian_waffle")
    spawn.spawnCreep(this.workerBodies, name)

    return "" // TODO:
  }
}

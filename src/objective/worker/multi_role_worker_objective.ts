import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveState } from "objective/objective"
import { SpawnCreepObjective } from "objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"
import { EnergyChargeableStructure } from "prototype/room_object"

type PrimitiveWorkerObjectiveProgressType = ObjectiveInProgress<void> | ObjectiveFailed<string>

export interface MultiRoleWorkerObjectiveState extends ObjectiveState {
  /** creeps */
  cr: {
    /** worker */
    w: CreepName[]
  }

  /** creep spawn queue */
  cq: {
    /** worker */
    w: CreepName[]
  }

  /** building construction site ID */
  cs: Id<ConstructionSite<BuildableStructureConstant>> | null
}

/**
 * - finishしない
 * - 外敵の影響でfailすることはある // TODO:
 * - [ ] 防衛設備のないときにinvaderが襲来したら部屋の外に出る
 */
export class MultiRoleWorkerObjective implements Objective {
  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private workerNames: CreepName[],
    private queuedWorkerNames: CreepName[],
    private buildingConstructionSiteId: Id<ConstructionSite<BuildableStructureConstant>> | null,
  ) {
  }

  public encode(): MultiRoleWorkerObjectiveState {
    return {
      t: "MultiRoleWorkerObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      cr: {
        w: this.workerNames,
      },
      cq: {
        w: this.queuedWorkerNames,
      },
      cs: this.buildingConstructionSiteId,
    }
  }

  public static decode(state: MultiRoleWorkerObjectiveState): MultiRoleWorkerObjective {
    const children = decodeObjectivesFrom(state.c)
    return new MultiRoleWorkerObjective(state.s, children, state.cr.w, state.cq.w, state.cs)
  }

  // ---- Public API ---- //
  public addCreeps(creepNames: CreepName[]): void {
    this.workerNames.push(...creepNames)
  }

  public didSpawnCreep(creepNames: CreepName[]): void {
    const spawnedCreepNames: CreepName[] = []
    this.queuedWorkerNames = this.queuedWorkerNames.filter(name => {
      if (creepNames.includes(name) !== true) {
        return true
      }
      spawnedCreepNames.push(name)
      return false
    })
    this.workerNames.push(...spawnedCreepNames)
  }

  public didCancelCreep(creepNames: CreepName[]): void {
    this.queuedWorkerNames = this.queuedWorkerNames.filter(name => creepNames.includes(name) !== true)
  }

  public progress(
    sources: Source[],
    chargeableStructures: EnergyChargeableStructure[],
    controller: StructureController,
    constructionSites: ConstructionSite<BuildableStructureConstant>[],
    spawnCreepObjective: SpawnCreepObjective,
  ): PrimitiveWorkerObjectiveProgressType {
    return new ObjectiveInProgress(undefined)
  }
}

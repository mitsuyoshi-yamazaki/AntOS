import { ErrorMapper } from "error_mapper/ErrorMapper"
import { BuildTask } from "game_object_task/creep_task/build_task"
import { HarvestEnergyTask } from "game_object_task/creep_task/harvest_energy_task"
import { RepairTask } from "game_object_task/creep_task/repair_task"
import { TransferToStructureTask } from "game_object_task/creep_task/transfer_to_structure_task"
import { UpgradeControllerTask } from "game_object_task/creep_task/upgrade_controller_task"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveState } from "objective/objective"
import { SpawnCreepObjective, spawnPriorityLow } from "objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"
import { EnergyChargeableStructure } from "prototype/room_object"
import { buildBodyParts } from "script/body_part_builder"
import { generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"

const numberOfWorkersEachSource = 8

interface PrimitiveWorkerObjectiveEvent {
  diedWorkers: number
  workers: number
  queueingWorkers: number
}

type PrimitiveWorkerObjectiveProgressType = ObjectiveInProgress<PrimitiveWorkerObjectiveEvent> | ObjectiveFailed<string>

export interface PrimitiveWorkerObjectiveState extends ObjectiveState {
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
export class PrimitiveWorkerObjective implements Objective {
  private readonly bodyUnit = [WORK, CARRY, MOVE, MOVE]
  private readonly bodyUnitCost: number

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private workerNames: CreepName[],
    private queuedWorkerNames: CreepName[],
    private buildingConstructionSiteId: Id<ConstructionSite<BuildableStructureConstant>> | null,
  ) {
    this.bodyUnitCost = this.bodyUnit.reduce((result, current) => result + BODYPART_COST[current], 0)
  }

  public encode(): PrimitiveWorkerObjectiveState {
    return {
      t: "PrimitiveWorkerObjective",
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

  public static decode(state: PrimitiveWorkerObjectiveState): PrimitiveWorkerObjective {
    const children = decodeObjectivesFrom(state.c)
    return new PrimitiveWorkerObjective(state.s, children, state.cr.w, state.cq.w, state.cs)
  }

  // ---- Public API ---- //
  public addCreeps(creepNames: CreepName[]): void {
    creepNames.forEach(name => {
      if (this.workerNames.includes(name) === true) {
        return
      }
      this.workerNames.push(name)
    })
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
    damagedStructures: AnyOwnedStructure[],
    spawnCreepObjective: SpawnCreepObjective,
  ): PrimitiveWorkerObjectiveProgressType {

    const workers: Creep[] = []
    const diedWorkers: CreepName[] = []
    this.workerNames.forEach(name => {
      const creep = Game.creeps[name]
      if (creep != null) {
        workers.push(creep)
        return
      }
      diedWorkers.push(name)
    })
    this.workerNames = this.workerNames.filter(name => diedWorkers.includes(name) !== true)

    const workersNeeded = (sources.length * numberOfWorkersEachSource) - (workers.length + this.queuedWorkerNames.length)
    if (workersNeeded > 0) {
      this.spawnWorkers(controller.room.energyCapacityAvailable, workersNeeded, spawnCreepObjective)
    }
    this.work(workers, sources, chargeableStructures, constructionSites, damagedStructures, controller)

    const event: PrimitiveWorkerObjectiveEvent = {
      diedWorkers: diedWorkers.length,
      workers: workers.length,
      queueingWorkers: this.queuedWorkerNames.length,
    }
    return new ObjectiveInProgress(event)
  }

  // ---- Private ---- //
  private work(
    workers: Creep[],
    sources: Source[],
    chargeableStructures: EnergyChargeableStructure[],
    constructionSites: ConstructionSite<BuildableStructureConstant>[],
    damagedStructures: AnyOwnedStructure[],
    controller: StructureController,
  ): void {

    workers.forEach(creep => {
      if (creep.spawning) {
        return
      }
      if (creep.task == null) {
        this.assignNewTask(creep, sources, chargeableStructures, constructionSites, damagedStructures, controller)
      }
      const taskFinished = creep.task?.run(creep) !== "in progress"
      if (taskFinished) {
        this.assignNewTask(creep, sources, chargeableStructures, constructionSites, damagedStructures, controller, true) // TODO: already run を Task.run() の返り値から取る
      }
    })
  }

  private assignNewTask(
    creep: Creep,
    sources: Source[],
    chargeableStructures: EnergyChargeableStructure[],
    constructionSites: ConstructionSite<BuildableStructureConstant>[],
    damagedStructures: AnyOwnedStructure[],
    controller: StructureController,
    alreadyRun?: boolean
  ): void {

    const noEnergy = (): boolean => {
      if (alreadyRun === true) {
        return creep.store.getUsedCapacity(RESOURCE_ENERGY) < creep.store.getCapacity() / 2  // タスクを実行済みである場合、storeが更新されていないため
      } else {
        return creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0
      }
    }
    if (noEnergy()) {
      const source = this.getSourceToAssign(sources, creep.pos)
      if (source != null) {
        creep.task = new HarvestEnergyTask(Game.time, source)
      } else {
        creep.task = null
      }
    } else {
      const structureToCharge = this.getStructureToCharge(chargeableStructures, creep.pos)
      if (structureToCharge != null) {
        creep.task = new TransferToStructureTask(Game.time, structureToCharge)
      } else {
        const damagedStructure = this.getRepairStructureToAssign(damagedStructures)
        if (damagedStructure != null) {
          creep.task = new RepairTask(Game.time, damagedStructure)
        } else {
          const constructionSite = this.getConstructionSiteToAssign(constructionSites)
          if (constructionSite != null) {
            creep.task = new BuildTask(Game.time, constructionSite)
          } else {
            creep.task = new UpgradeControllerTask(Game.time, controller)
          }
        }
      }
    }
  }

  private getSourceToAssign(sources: Source[], position: RoomPosition): Source | null {
    if (sources.length <= 0) {
      return null
    }
    return sources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  private getStructureToCharge(chargeableStructures: EnergyChargeableStructure[], position: RoomPosition): EnergyChargeableStructure | null {
    if (chargeableStructures.length <= 0) {
      return null
    }
    return chargeableStructures.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })
  }

  private getConstructionSiteToAssign(constructionSites: ConstructionSite<BuildableStructureConstant>[]): ConstructionSite<BuildableStructureConstant> | null {
    const storedConstructionSite = ((): ConstructionSite<BuildableStructureConstant> | null => {
      if (this.buildingConstructionSiteId == null) {
        return null
      }
      return Game.getObjectById(this.buildingConstructionSiteId)
    })()
    if (storedConstructionSite != null) {
      return storedConstructionSite
    }

    const constructionSite = constructionSites[0]
    this.buildingConstructionSiteId = constructionSite?.id
    return constructionSite
  }

  private getRepairStructureToAssign(damagedStructures: AnyOwnedStructure[]): AnyOwnedStructure | null {
    return damagedStructures[0] ?? null
  }

  // ---- Spawn ---- //
  private spawnWorkers(energyCapacity: number, workerNeeded: number, spawnCreepObjective: SpawnCreepObjective): void {
    const body = ((): BodyPartConstant[] => {
      if (this.workerNames.length > 0) {
        return buildBodyParts(energyCapacity, this.bodyUnit, 3, this.bodyUnitCost)
      }
      return this.bodyUnit
    })()

    ErrorMapper.wrapLoop((): void => {
      for (let i = 0; i < workerNeeded; i += 1) {
        const creepName = generateUniqueId("mont_blanc")
        const memory: CreepMemory = {
          ts: null,
          tt: 0,
          squad_name: "",
          status: CreepStatus.NONE,
          type: CreepType.WORKER,
          birth_time: Game.time,
          should_notify_attack: false,
          let_thy_die: true,
        }
        spawnCreepObjective.enqueueCreep(creepName, body, memory, spawnPriorityLow)
        this.queuedWorkerNames.push(creepName)
      }
    }, "PrimitiveWorkerObjective.spawnWorkers()")()
  }
}

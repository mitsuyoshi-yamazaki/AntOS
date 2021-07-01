import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveState } from "old_objective/objective"
import { OwnedRoomObjects } from "old_objective/room_keeper/owned_room_object_cache"
import { SpawnCreepObjective, spawnPriorityLow } from "old_objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"
import { generateCodename, generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"
import { WorkerObjective, WorkerObjectiveProgressType } from "./worker_objective"

type MultiRoleWorkerObjectiveCreepType = CreepType.WORKER | CreepType.CARRIER | CreepType.HARVESTER

export interface MultiRoleWorkerObjectiveState extends ObjectiveState {
  /** creep names */
  cr: CreepName[]

  /** creep names in queue */
  cq: CreepName[]
}

/**
 * - finishしない
 * - 外敵の影響でfailすることはある // TODO:
 * - [ ] 防衛設備のないときにinvaderが襲来したら部屋の外に出る
 */
export class MultiRoleWorkerObjective implements WorkerObjective {
  public readonly objectiveType = "worker"

  private readonly codename = generateCodename(this.constructor.name, this.startTime)

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private creepNames: CreepName[],
    private queuedCreepNames: CreepName[],
  ) {
  }

  public encode(): MultiRoleWorkerObjectiveState {
    return {
      t: "MultiRoleWorkerObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      cr: this.creepNames,
      cq: this.queuedCreepNames,
    }
  }

  public static decode(state: MultiRoleWorkerObjectiveState): MultiRoleWorkerObjective {
    const children = decodeObjectivesFrom(state.c)
    return new MultiRoleWorkerObjective(state.s, children, state.cr, state.cq)
  }

  // ---- Public API ---- //
  public addCreeps(names: CreepName[]): void {
    names.forEach(name => {
      if (this.creepNames.includes(name) === true) {
        return
      }
      this.creepNames.push(name)
    })
  }

  public didSpawnCreep(names: CreepName[]): void {
    const spawnedCreepNames: CreepName[] = []
    this.queuedCreepNames = this.queuedCreepNames.filter(name => {
      if (names.includes(name) !== true) {
        return true
      }
      spawnedCreepNames.push(name)
      return false
    })
    this.creepNames.push(...spawnedCreepNames)
  }

  public didCancelCreep(names: CreepName[]): void {
    this.queuedCreepNames = this.queuedCreepNames.filter(name => names.includes(name) !== true)
  }

  public progress(roomObjects: OwnedRoomObjects, spawnCreepObjective: SpawnCreepObjective): WorkerObjectiveProgressType {
    const deadCreepNames: CreepName[] = []
    const creeps = this.creepNames.reduce((result, current) => {
      const creep = Game.creeps[current]
      if (creep != null) {
        result.push(creep)
      } else {
        deadCreepNames.push(current)
      }
      return result
    }, [] as Creep[])


    this.runSpawn(creeps, roomObjects.controller.room.energyCapacityAvailable, spawnCreepObjective)

    return new ObjectiveFailed("in progress") // TODO:
  }

  // ---- Harvester ---- //
  private runHarvester() {

  }

  // ---- Worker ---- //

  // ---- Spawn ---- //
  private runSpawn(creeps: Creep[], energyCapacityAvailable: number, spawnCreepObjective: SpawnCreepObjective): void {
    if (creeps.length <= 0) {
      this.spawn(CreepType.HARVESTER, energyCapacityAvailable, spawnCreepObjective)
      return
    }
  }

  private spawn(creepType: MultiRoleWorkerObjectiveCreepType, energyCapacityAvailable: number, spawnCreepObjective: SpawnCreepObjective): void {
    const creepName = generateUniqueId(this.codename)
    const body = this.bodyParts(creepType, energyCapacityAvailable)
    const memory: CreepMemory = {
      ts: null,
      tt: 0,
      squad_name: "",
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: creepType,
      should_notify_attack: false,
      let_thy_die: true,
    }

    spawnCreepObjective.enqueueCreep(creepName, body, memory, spawnPriorityLow)
    this.queuedCreepNames.push(creepName)
  }

  private bodyParts(creepType: MultiRoleWorkerObjectiveCreepType, energyCapacityAvailable: number): BodyPartConstant[] {
    switch (creepType) {
    case CreepType.HARVESTER:
      return [MOVE, CARRY, WORK]
    case CreepType.CARRIER:
      return [CARRY, MOVE]
    case CreepType.WORKER:
      return [MOVE, CARRY, WORK]
    }
  }
}

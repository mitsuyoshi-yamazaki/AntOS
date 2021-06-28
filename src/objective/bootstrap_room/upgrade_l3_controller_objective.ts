import { ErrorMapper } from "error_mapper/ErrorMapper"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState } from "objective/objective"
import { generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"
import { UpgradeControllerTask } from "game_object_task/creep_task/upgrade_controller_task"
import { TransferToStructureTask } from "game_object_task/creep_task/transfer_to_structure_task"
import { CreepName } from "prototype/creep"
import { HarvestEnergyTask } from "game_object_task/creep_task/harvest_energy_task"
import { BuildTask } from "game_object_task/creep_task/build_task"
import { RoomPathMemory } from "prototype/room"
import { calculateSourceRoute } from "script/pathfinder"
import { SpawnCreepTask } from "game_object_task/spwan_task/spawn_creep_task"

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

    /** worker names in spawn cache */
    cw: CreepName[]

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
  private baseWorkerBodies: BodyPartConstant[] = [WORK, CARRY, MOVE, MOVE]
  private baseWorkerSpawnEnergy = 100 + 50 + 50 + 50

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    private workerNames: CreepName[],
    private workerNamesInCache: CreepName[],
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
        cw: this.workerNamesInCache,
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
    return new UpgradeL3ControllerObjective(state.s, children, state.cr.w, state.cr.cw, state.cr.hv, state.cr.hl, state.si, workingInfo)
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

      const workerNamesInCache: CreepName[] = []
      this.workerNamesInCache.forEach(name => {
        const creep = Game.creeps[name]
        if (creep == null) {
          workerNamesInCache.push(name)
        } else {
          this.workerNames.push(name)
          workers.push(creep)
        }
      })
      this.workerNamesInCache = workerNamesInCache

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

      const spawnIdentifier = `${spawn.room.name}_${this.constructor.name}`
      const spawnTask = ((): SpawnCreepTask | null => {
        if (spawn.task instanceof SpawnCreepTask) {
          return spawn.task
        }
        return null
      })()
      const numberOfWorkers = workers.length + this.workerNamesInCache.length
      const hasEnoughWorkers = numberOfWorkers >= numberOfWorkersEachSource * sources.length

      // if (hasEnoughWorkers !== true) {
      //   if (spawnTask != null) {
      //     const targetSource = this.getSourceToAssign(sources, spawn.pos)
      //     this.spawnWorker(spawnTask, spawnIdentifier, targetSource)
      //   } else if (spawn.task == null) {
      //     const newSpawnTask = new SpawnCreepTask(Game.time, [], null)
      //     spawn.task = newSpawnTask
      //     const targetSource = this.getSourceToAssign(sources, spawn.pos)
      //     this.spawnWorker(newSpawnTask, spawnIdentifier, targetSource)
      //   }
      // }
      // if (spawn.task != null) {
      //   if (spawn.task.run(spawn) !== "in progress") {
      //     spawn.task = null
      //   }
      // }

      this.work(workers, controller, sources, spawn)
      progress = new ObjectiveInProgress(`${workers.length} working`)

      this._sourceRoute(controller.room, sources, spawn)

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
        this.assignNewTask(creep, sources, spawn, controller)
      }
      const taskFinished = creep.task?.run(creep) !== "in progress"
      if (taskFinished) {
        this.assignNewTask(creep, sources, spawn, controller, true) // TODO: already run を Task.run() の返り値から取る
      }
    })
  }

  private assignNewTask(creep: Creep, sources: Source[], spawn: StructureSpawn, controller: StructureController, alreadyRun?: boolean): void {
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

  private getSourceToAssign(sources: Source[], position: RoomPosition): Source | null {
    return sources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.targetedBy.length
      const rTargetedBy = rhs.targetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return lhs.pos.getRangeTo(position) < rhs.pos.getRangeTo(position) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
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
  // private spawnWorker(spawnTask: SpawnCreepTask, identifier: string, targetSource: Source | null): void {
  //   const time = Game.time
  //   const initialTask = targetSource != null ? new HarvestEnergyTask(time, targetSource) : null
  //   const creepName = generateUniqueId("belgian_waffle")
  //   const memory: CreepMemory = {
  //     ts: initialTask?.encode() ?? null,
  //     squad_name: "",
  //     status: CreepStatus.NONE,
  //     type: CreepType.WORKER,
  //     birth_time: time,
  //     should_notify_attack: false,
  //     let_thy_die: true,
  //   }

  //   spawnTask.addCreepToSpawn(identifier, creepName, this.baseWorkerBodies, memory, spawnPriorityLow)
  //   this.workerNamesInCache.push(creepName)
  // }

  // ---- Source route ---- //
  private _sourceRoute(room: Room, sources: Source[], spawn: StructureSpawn): void {  // TODO: 適切なインターフェースにする
    const pathInMemory: RoomPathMemory = room.memory.p ?? {s: {}}
    if (room.memory.p == null) {
      room.memory.p = pathInMemory
    }

    sources.forEach(source => {
      const sourcePath = pathInMemory.s[source.id]
      if (sourcePath == null) {
        const result = calculateSourceRoute(source.id, spawn.pos)
        switch (result.resultType) {
        case "succeeded": {
          const path = result.value.path.path.map(position => ({ x: position.x, y: position.y }))
          path.push(...result.value.harvestPositions.map(position => ({ x: position.x, y: position.y })))
          pathInMemory.s[source.id] = {
            p: path,
            d: { x: spawn.pos.x, y: spawn.pos.y },
          }
          console.log(`source path calculated with ${result.value.harvestPositions.length} harvest position`)
          break
        }
        case "failed":
          pathInMemory.s[source.id] = "no path"
          console.log(`source path cannot found: ${result.reason}`)
          break
        }
        return
      }
      if (sourcePath === "no path") {
        return
      }
      // console.log(`source path found for ${source.id}`)
      // sourcePath.p.forEach(position => source.room.visual.text("*", position.x, position.y))
    })
  }
}

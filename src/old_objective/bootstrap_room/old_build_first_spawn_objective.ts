import { BuildTask } from "game_object_task/creep_task/build_task"
import { HarvestEnergyTask } from "game_object_task/creep_task/harvest_energy_task"
import { SingleCreepProviderObjective } from "old_objective/creep_provider/single_creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState } from "old_objective/objective"
import { spawnPriorityLow } from "old_objective/spawn/spawn_creep_objective"
import { CreepName } from "prototype/creep"
import { roomLink } from "utility/log"
import { Migration } from "utility/migration"
import { generateUniqueId } from "utility/unique_id"
import { CreepStatus, CreepType } from "_old/creep"

const maxNumberOfWorkers = 12

type OldBuildFirstSpawnObjectiveProgressType = ObjectiveProgressType<string, StructureSpawn, string>

export interface OldBuildFirstSpawnObjectiveState extends ObjectiveState {
  /** creep names */
  cr: {
    /** worker */
    w: CreepName[]
  }

  /** creep spawn queue */
  cq: {
    /** worker */
    w: CreepName[]
  }
}

export class OldBuildFirstSpawnObjective implements Objective {
  private creepIdentifierIndex = 0

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public workerNames: CreepName[],
    public workerNamesInQueue: CreepName[]
  ) {
  }

  public encode(): OldBuildFirstSpawnObjectiveState {
    return {
      t: "OldBuildFirstSpawnObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      cr: {
        w: this.workerNames,
      },
      cq: {
        w: this.workerNamesInQueue,
      }
    }
  }

  public static decode(state: OldBuildFirstSpawnObjectiveState): OldBuildFirstSpawnObjective {
    const children = decodeObjectivesFrom(state.c)
    return new OldBuildFirstSpawnObjective(state.s, children, state.cr.w, state.cq.w)
  }

  public progress(targetRoom: Room, parentRoomName: string): OldBuildFirstSpawnObjectiveProgressType {
    const inProgressMessages: string[] =this.checkChildrenProgress()

    const spawnConstructionSite = (targetRoom.construction_sites ?? [])[0]
    if (spawnConstructionSite == null) {
      const flag = targetRoom.find(FIND_FLAGS).find(flag => flag.color === COLOR_GREY)
      if (flag == null) {
        return new ObjectiveFailed(`No spawn construction site in ${roomLink(targetRoom.name)}`)
      }
      targetRoom.createConstructionSite(flag.pos.x, flag.pos.y, STRUCTURE_SPAWN)
      flag.remove()
      return new ObjectiveInProgress(`Created spawn construction site at ${flag.pos}`)
    }
    if (spawnConstructionSite.structureType !== STRUCTURE_SPAWN) {
      return new ObjectiveFailed(`Construction site ${spawnConstructionSite.id} is not a spawn`)
    }

    const creepProviders: SingleCreepProviderObjective[] = this.children.filter(child => child instanceof SingleCreepProviderObjective) as SingleCreepProviderObjective[]
    const numberOfWorkers = this.workerNames.length + this.workerNamesInQueue.length + creepProviders.length

    if (numberOfWorkers < maxNumberOfWorkers) {
      const creepIdentifier = this.createCreepIdentifier()
      this.addWorker(creepIdentifier, parentRoomName)
      inProgressMessages.push(`Add worker with identifier ${creepIdentifier}`)
    }

    const workers: Creep[] = []
    const aliveWorkerNames: CreepName[] = []
    this.workerNames.forEach(name => {
      const creep = Game.creeps[name]
      if (creep instanceof Creep) {
        workers.push(creep)
        aliveWorkerNames.push(name)
      } else {
        inProgressMessages.push(`Worker creep ${name} died.`)
      }
    })
    const spawnedWorkerNames: CreepName[] = []
    this.workerNamesInQueue.forEach(name => {
      const creep = Game.creeps[name]
      if (creep instanceof Creep) {
        workers.push(creep)
        spawnedWorkerNames.push(name)
      }
    })
    this.workerNamesInQueue = this.workerNamesInQueue.filter(name => spawnedWorkerNames.includes(name) !== true)
    this.workerNames = aliveWorkerNames.concat(spawnedWorkerNames)

    this.work(workers, targetRoom, targetRoom.sources, spawnConstructionSite as ConstructionSite<STRUCTURE_SPAWN>)
    inProgressMessages.push(`${workers.length} workers running, ${creepProviders.length} creeps spawning`)

    if (inProgressMessages.length > 0) {
      return new ObjectiveInProgress(inProgressMessages.join("\n"))
    }
    return new ObjectiveInProgress("not implemented yet")
  }

  // ---- Work ---- //
  private work(workers: Creep[], targetRoom: Room, sources: Source[], constructionSite: ConstructionSite<STRUCTURE_SPAWN>): void {
    workers.forEach(creep => {
      if (creep.spawning) {
        return
      }
      if (creep.room.name !== targetRoom.name) {
        creep.moveToRoom(targetRoom.name)
        return
      }

      if (creep.v4Task == null) {
        this.assignNewTask(creep, sources, constructionSite)
      }
      const taskFinished = creep.v4Task?.run(creep) !== "in progress"
      if (taskFinished) {
        this.assignNewTask(creep, sources, constructionSite, true)
      }
    })
  }

  private assignNewTask(creep: Creep, sources: Source[], constructionSite: ConstructionSite<STRUCTURE_SPAWN>, alreadyRun?: boolean): void {
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
        creep.v4Task = new HarvestEnergyTask(Game.time, source)
      } else {
        creep.v4Task = null
      }
    } else {
      creep.v4Task = new BuildTask(Game.time, constructionSite)
    }
  }

  private getSourceToAssign(sources: Source[]): Source | null {
    return sources.reduce((lhs, rhs) => {
      return lhs.targetedBy.length < rhs.targetedBy.length ? lhs : rhs
    })
  }

  // ---- Add creeps ---- //
  private addWorker(creepIdentifier: string, parentRoomName: string): void {
    if (Migration.isOldRoom(parentRoomName) === true) {
      this.requestToCreepProvider(creepIdentifier, parentRoomName)
    } else {
      this.addWorkerQueue(creepIdentifier, parentRoomName)
    }
  }

  private requestToCreepProvider(creepIdentifier: string, parentRoomName: string): void {
    const args = {
      spawnRoomName: parentRoomName,
      requestingCreepBodyParts: [
        WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE,
        WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE,
      ],
      priority: spawnPriorityLow,
    }
    const objective = new SingleCreepProviderObjective(Game.time, [], creepIdentifier, args)
    this.children.push(objective)
  }

  private addWorkerQueue(creepIdentifier: string, parentRoomName: string): void {
    if (Memory.creepRequests[parentRoomName] == null) {
      Memory.creepRequests[parentRoomName] = []
    }

    const creepName = generateUniqueId("chocolate_parfait")
    const body: BodyPartConstant[] = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]
    const memory: CreepMemory = {
      ts: null,

      squad_name: "",
      status: CreepStatus.NONE,
      birth_time: Game.time,
      type: CreepType.CREEP_PROVIDER,
      should_notify_attack: false,
      let_thy_die: true,
    }

    Memory.creepRequests[parentRoomName].push({
      t: Game.time,
      b: body,
      p: spawnPriorityLow,
      n: creepName,
      m: memory,
    })
    this.workerNamesInQueue.push(creepName)
  }

  private createCreepIdentifier(): string {
    const identifier = `melon_parfait_${Game.time}_${this.creepIdentifierIndex}`
    this.creepIdentifierIndex += 1
    return identifier
  }

  private checkChildrenProgress(): string[] {
    const progressMessages: string[] = []
    this.children.forEach(child => {
      if (child instanceof SingleCreepProviderObjective) {
        const progress = this.checkCreepProviderProgress(child)
        if (progress != null) {
          progressMessages.push(progress)
        }
        return
      }
    })
    return progressMessages
  }

  private checkCreepProviderProgress(objective: SingleCreepProviderObjective): string | null {
    const progress = objective.progress()
    switch (progress.objectProgressType) {
    case "in progress":
      return null
    case "succeeded":
      this.removeChildObjective(objective)
      this.workerNames.push(progress.result.name)
      return `Worker ${progress.result.name} received.`
    case "failed":
      this.removeChildObjective(objective)
      return progress.reason
    }

  }

  private removeChildObjective(objective: Objective): void {
    const index = this.children.indexOf(objective)
    if (index) {
      this.children.splice(index, 1)
    }
  }
}

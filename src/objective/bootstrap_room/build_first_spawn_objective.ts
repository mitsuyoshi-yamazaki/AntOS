import { BuildTask } from "game_object_task/creep_task/build_task"
import { HarvestEnergyTask } from "game_object_task/creep_task/harvest_energy_task"
import { SingleCreepProviderObjective } from "objective/creep_provider/single_creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState } from "objective/objective"
import { roomLink } from "utility/log"

const maxNumberOfWorkers = 12

type BuildFirstSpawnObjectiveProgressType = ObjectiveProgressType<string, StructureSpawn, string>

export interface BuildFirstSpawnObjectiveState extends ObjectiveState {
  /** creep IDs */
  cr: {
    /** worker */
    w: string[]
  }
}

export class BuildFirstSpawnObjective implements Objective {
  private creepIdentifierIndex = 0

  public constructor(
    public readonly startTime: number,
    public readonly children: Objective[],
    public workerIds: string[],
  ) {
  }

  public encode(): BuildFirstSpawnObjectiveState {
    return {
      t: "BuildFirstSpawnObjective",
      s: this.startTime,
      c: this.children.map(child => child.encode()),
      cr: {
        w: this.workerIds,
      }
    }
  }

  public static decode(state: BuildFirstSpawnObjectiveState): BuildFirstSpawnObjective {
    const children = decodeObjectivesFrom(state.c)
    return new BuildFirstSpawnObjective(state.s, children, state.cr.w)
  }

  public progress(targetRoom: Room, parentRoomName: string): BuildFirstSpawnObjectiveProgressType {
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
    const numberOfWorkers = this.workerIds.length + creepProviders.length

    if (numberOfWorkers < maxNumberOfWorkers) {
      const creepIdentifier = this.createCreepIdentifier()
      this.addWorker(creepIdentifier, parentRoomName)
      inProgressMessages.push(`Add worker with identifier ${creepIdentifier}`)
    }

    const workers: Creep[] = []
    const aliveWorkerIds: string[] = []
    this.workerIds.forEach(workerId => {
      const creep = Game.getObjectById(workerId)
      if (creep instanceof Creep) {
        workers.push(creep)
        aliveWorkerIds.push(workerId)
      } else {
        inProgressMessages.push(`Worker creep ${workerId} died.`)
      }
    })
    this.workerIds = aliveWorkerIds

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

      if (creep.task == null) {
        this.assignNewTask(creep, sources, constructionSite)
      }
      const taskFinished = creep.task?.run(creep) !== "in progress"
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
        creep.task = new HarvestEnergyTask(Game.time, source)
      } else {
        creep.task = null
      }
    } else {
      creep.task = new BuildTask(Game.time, constructionSite)
    }
  }

  private getSourceToAssign(sources: Source[]): Source | null {
    return sources.reduce((lhs, rhs) => {
      return lhs.targetedBy.length < rhs.targetedBy.length ? lhs : rhs
    })
  }

  // ---- Add creeps ---- //
  private addWorker(creepIdentifier: string, parentRoomName: string): void {
    const args = {
      spawnRoomName: parentRoomName,
      requestingCreepBodyParts: [
        WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE,
        WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE,
      ],
    }
    const objective = new SingleCreepProviderObjective(Game.time, [], creepIdentifier, args)
    this.children.push(objective)
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
      this.workerIds.push(progress.result.id)
      return `Worker ${progress.result.id} received.`
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

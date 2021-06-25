import { SingleCreepProviderObjective } from "task/creep_provider/single_creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState } from "task/objective"
import { roomLink } from "utility/log"
import { CreepStatus } from "_old/creep"

const maxNumberOfWorkers = 5

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
    public readonly workerIds: string[],
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
      return new ObjectiveFailed(`No spawn construction site in ${roomLink(targetRoom.name)}`)
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
    this.workerIds.forEach(workerId => {
      const creep = Game.getObjectById(workerId)
      if (creep instanceof Creep) {
        workers.push(creep)
      }
    })
    workers.forEach(creep => {
      this.runWorker(creep, spawnConstructionSite as ConstructionSite<STRUCTURE_SPAWN>, targetRoom)
    })
    if (workers.length > 0) {
      inProgressMessages.push(`${workers.length} workers running`)
    }

    if (inProgressMessages.length > 0) {
      return new ObjectiveInProgress(inProgressMessages.join("\n"))
    }
    return new ObjectiveInProgress("not implemented yet")
  }

  // ---- Run worker ---- //
  private runWorker(creep: Creep, constructionSite: ConstructionSite<STRUCTURE_SPAWN>, targetRoom: Room): void {
    if (creep.room.name !== targetRoom.name) {
      creep.moveToRoom(targetRoom.name)
      return
    }
    const source = targetRoom.sources[0]
    if (source == null) {
      console.log(`Unexpectedly missing source in ${roomLink(targetRoom.name)}`)
      return
    }

    switch (creep.memory.status) {
    case CreepStatus.HARVEST:
      if (creep.carry[RESOURCE_ENERGY] >= creep.carryCapacity) {
        creep.memory.status = CreepStatus.BUILD
        break
      }
      this.harvest(creep, source)
      break
    case CreepStatus.BUILD:
      if (creep.carry[RESOURCE_ENERGY] <= 0) {
        creep.memory.status = CreepStatus.HARVEST
        break
      }
      this.build(creep, constructionSite)
      break
    default:
      creep.memory.status = CreepStatus.HARVEST
    }
  }

  private harvest(creep: Creep, source: Source): void {
    if (creep.harvest(source) !== OK) {
      creep.moveTo(source)
    }
  }

  private build(creep: Creep, constructionSite: ConstructionSite<STRUCTURE_SPAWN>): void {
    if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
      creep.moveTo(constructionSite)
    }
  }

  // ---- Add creeps ---- //
  private addWorker(creepIdentifier: string, parentRoomName: string): void {
    const args = {
      spawnRoomName: parentRoomName,
      requestingCreepBodyParts: [
        WORK, WORK, CARRY, CARRY, MOVE, MOVE,
        WORK, WORK, CARRY, CARRY, MOVE, MOVE,
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

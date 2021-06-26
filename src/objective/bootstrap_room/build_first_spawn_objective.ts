import { SingleCreepProviderObjective } from "objective/creep_provider/single_creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveFailed, ObjectiveInProgress, ObjectiveProgressType, ObjectiveState } from "objective/objective"
import { roomLink } from "utility/log"
import { CreepStatus } from "_old/creep"

const maxNumberOfWorkers = 8

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
    private workerIds: string[],
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
      const flag = targetRoom.find(FIND_FLAGS)[0]
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

    workers.forEach(creep => {
      this.runWorker(creep, spawnConstructionSite as ConstructionSite<STRUCTURE_SPAWN>, targetRoom)
    })
    inProgressMessages.push(`${workers.length} workers running, ${creepProviders.length} creeps spawning`)

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

    const build = () => this.build(creep, constructionSite)
    const harvest = () => this.harvest(creep)

    switch (creep.memory.status) {
    case CreepStatus.HARVEST:
      if (creep.carry[RESOURCE_ENERGY] >= creep.carryCapacity) {
        creep.memory.status = CreepStatus.BUILD
        build()
        break
      }
      harvest()
      break
    case CreepStatus.BUILD:
      if (creep.carry[RESOURCE_ENERGY] <= 0) {
        creep.memory.status = CreepStatus.HARVEST
        harvest()
        break
      }
      build()
      break
    default:
      creep.memory.status = CreepStatus.HARVEST
    }
  }

  private harvest(creep: Creep): void {
    const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE)
    if (source == null) {
      return
    }
    if (creep.harvest(source) !== OK) {
      creep.moveTo(source, { reusePath: 15 })
    }
  }

  private build(creep: Creep, constructionSite: ConstructionSite<STRUCTURE_SPAWN>): void {
    if (creep.build(constructionSite) === ERR_NOT_IN_RANGE) {
      creep.moveTo(constructionSite, { reusePath: 15 })
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

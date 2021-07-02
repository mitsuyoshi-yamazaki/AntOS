import { ScoutTask } from "game_object_task/creep_task/scout_task"
import { SingleCreepProviderObjective } from "old_objective/creep_provider/single_creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveState } from "old_objective/objective"
import { Procedural } from "old_objective/procedural"
import { spawnPriorityLow } from "old_objective/spawn/spawn_creep_objective"
import { Process, processLog, ProcessState } from "process/process"
import { CreepName } from "prototype/creep"
import { generateCodename, generateUniqueId } from "utility/unique_id"
import { CreepType } from "_old/creep"

type Season3War11353ProcessCreepType = CreepType.SCOUT

const ownedRoomName = "W27S26"
const scoutTargets: RoomPosition[] = [
  new RoomPosition(29, 6, "W23S25")
]

export interface Season3War11353ProcessState extends ProcessState {
  /** child objective states */
  s: ObjectiveState[]

  /** creep names */
  cr: CreepName[]
}

export class Season3War11353Process implements Process, Procedural {
  private readonly codename = generateCodename(this.constructor.name, this.launchTime)

  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
    private readonly objectives: Objective[],
    private creepName: CreepName[],
  ) { }

  public encode(): Season3War11353ProcessState {
    return {
      t: "Season3War11353Process",
      l: this.launchTime,
      i: this.processId,
      s: this.objectives.map(objective => objective.encode()),
      cr: this.creepName,
    }
  }

  public static decode(state: Season3War11353ProcessState): Season3War11353Process {
    const objectives = decodeObjectivesFrom(state.s)
    return new Season3War11353Process(state.l, state.i, objectives, state.cr)
  }

  public runOnTick(): void {
    const [spawningCreepNames, scouts] = this.refreshCreeps()

    this.runScouts(scouts, spawningCreepNames.length > 0)
  }

  // ---- Scout ---- //
  private runScouts(scouts: Creep[], isSpawning: boolean): void {
    const nonTargetedPositions = scoutTargets.concat([])

    scouts.forEach(creep => {
      if (creep.task instanceof ScoutTask) {
        const scoutTask = creep.task
        const index = nonTargetedPositions.findIndex(position => position.isEqualTo(scoutTask.position))
        if (index >= 0) {
          nonTargetedPositions.splice(index, 1)
        }
      }
    })

    scouts.forEach(creep => {
      if (creep.task != null) {
        creep.task.run(creep)
      } else {
        const position = nonTargetedPositions.shift() ?? scoutTargets[0]
        creep.task = new ScoutTask(Game.time, position)
        creep.task.run(creep)
      }
    })

    if (isSpawning !== true) {
      for (let i = 0; i < nonTargetedPositions.length; i += 1) {
        this.addCreep(CreepType.SCOUT)
      }
    }
  }

  // ---- Spawn ---- //
  /**
   * @returns [spawningCreepNames, scouts]
   */
  private refreshCreeps(): [CreepName[], Creep[]] {
    const scouts: Creep[] = []
    const diedCreepNames: CreepName[] = []
    const spawningCreepNames = this.objectives.reduce((result, current) => {
      if (current instanceof SingleCreepProviderObjective) {
        result.push(current.creepName)
      }
      return result
    }, [] as CreepName[])

    this.creepName.forEach(creepName => {
      const creep = Game.creeps[creepName]
      if (creep != null) {
        switch (creep.memory.type) {
        case CreepType.SCOUT:
          scouts.push(creep)
          break
        default:
          scouts.push(creep)  // FixMe: 判定する
          creep.memory.type = CreepType.SCOUT
          break
        }
        return
      }
      if (spawningCreepNames.includes(creepName) === true) {
        return
      }
      diedCreepNames.push(creepName)
    })

    this.creepName = this.creepName.filter(creepName => diedCreepNames.includes(creepName) !== true)

    return [spawningCreepNames, scouts]
  }

  private addCreep(creepType: Season3War11353ProcessCreepType): void {
    const creepName = generateUniqueId(this.codename)
    const creepProvider = new SingleCreepProviderObjective(
      Game.time,
      [],
      creepName,
      {
        spawnRoomName: ownedRoomName,
        requestingCreepBodyParts: [MOVE], // TODO:
        priority: spawnPriorityLow,
      }
    )
    this.objectives.push(creepProvider)
    this.creepName.push(creepName)
    processLog(this, `Added creep ${creepName}, type: ${creepType}`)
  }
}

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
const targetRoomName = "W23S25"
const scoutTargets: RoomPosition[] = [
  new RoomPosition(29, 6, "W23S25"),
  new RoomPosition(18, 10, "W23S25"),
  new RoomPosition(18, 11, "W23S25"),
  new RoomPosition(18, 12, "W23S25"),
  new RoomPosition(19, 12, "W23S25"),
  new RoomPosition(20, 12, "W23S25"),

  new RoomPosition(4, 19, "W23S25"),
  new RoomPosition(26, 36, "W23S25"),
  new RoomPosition(36, 18, "W23S25"),
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
    // const ob = this.objectives.find(o => {
    //   if (o instanceof SingleCreepProviderObjective) {
    //     if (o.creepName === "baked_beer_32fa2") {
    //       return true
    //     }
    //   }
    //   return false
    // })
    // if (ob != null) {
    //   this.removeObjective(ob)
    // }

    const takeOverNames: CreepName[] = [
    ]
    takeOverNames.forEach(name => {
      const creep = Game.creeps[name]
      if (creep == null) {
        return
      }
      if (this.creepName.includes(name) !== true) {
        this.creepName.push(name)
      }
    })

    this.runObjectives()

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

    const room = Game.rooms[targetRoomName]

    const towerConstructionSite = ((): ConstructionSite<STRUCTURE_TOWER> | null => {
      if (room == null) {
        return null
      }
      return room.find(FIND_CONSTRUCTION_SITES).filter(site => site.structureType === STRUCTURE_TOWER)[0] as ConstructionSite<STRUCTURE_TOWER> | null
    })()

    const anyConstructionSites = ((): ConstructionSite<BuildableStructureConstant>[] => {
      if (room == null) {
        return []
      }
      return room.find(FIND_CONSTRUCTION_SITES)
    })()

    const hostileSpawn = ((): StructureSpawn | null => {
      if (room == null) {
        return null
      }
      return room.find(FIND_HOSTILE_SPAWNS)[0]
    })()

    const hostileAttackers = ((): Creep[] => {
      if (room == null) {
        return []
      }
      return room.find(FIND_HOSTILE_CREEPS).filter(creep => {
        const body = creep.body.map(b => b.type)
        if (body.includes(ATTACK) === true) {
          return true
        }
        if (body.includes(RANGED_ATTACK) === true) {
          return true
        }
        return false
      })
    })()

    scouts.forEach(creep => {
      const hostileAttacker = creep.pos.findInRange(hostileAttackers, 3)[0]
      if (hostileAttacker != null) {
        const path = PathFinder.search(creep.pos, hostileAttacker.pos, {
          flee: true,
          maxRooms: 1,
        })
        creep.moveByPath(path.path)
        return
      }


      if (creep.room.name === targetRoomName) {
        if (hostileSpawn != null && (room.controller?.safeMode ?? 0) <= 0 && creep.body.map(b => b.type).includes(WORK) === true) {
          if (creep.dismantle(hostileSpawn) !== OK) {
            creep.moveTo(hostileSpawn)
          }
          return
        }

        if (towerConstructionSite != null) {
          creep.moveTo(towerConstructionSite, { reusePath: 0 })
          return
        }

        if (anyConstructionSites.length > 0) {
          const target = creep.pos.findClosestByPath(anyConstructionSites)
          if (target != null) {
            creep.moveTo(target, {reusePath: 0})
            return
          }
        }
      }

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

  // ---- Targeting ---- //


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
        // requestingCreepBodyParts: [MOVE, MOVE, MOVE, MOVE, MOVE, WORK], // TODO:
        requestingCreepBodyParts: [MOVE], // TODO:
        priority: spawnPriorityLow,
      }
    )
    this.objectives.push(creepProvider)
    this.creepName.push(creepName)
    processLog(this, `Added creep ${creepName}, type: ${creepType}`)
  }

  private runObjectives(): void {
    const objectivesToRemove: Objective[] = []

    this.objectives.forEach(objective => {
      if (objective instanceof SingleCreepProviderObjective) {
        const provider = objective

        const progress = objective.progress()
        switch (progress.objectProgressType) {
        case "in progress":
          // if (this.creepName.includes(provider.creepName) === true) {
          //   objectivesToRemove.push(provider)
          // }
          break
        case "succeeded":
          objectivesToRemove.push(provider)
          break
        case "failed": {
          const index = this.creepName.indexOf(objective.creepName)
          if (index >= 0) {
            this.creepName.splice(index, 1)
          }
          objectivesToRemove.push(provider)
          break
        }
        }
      }
    })

    objectivesToRemove.forEach(o => {
      this.removeObjective(o)
    })
  }

  private removeObjective(objective: Objective): void {
    const index = this.objectives.indexOf(objective)
    if (index < 0) {
      return
    }
    this.objectives.splice(index, 1)
  }
}

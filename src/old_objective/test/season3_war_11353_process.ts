import { ScoutTask } from "game_object_task/creep_task/scout_task"
import { SingleCreepProviderObjective } from "old_objective/creep_provider/single_creep_provider_objective"
import { decodeObjectivesFrom, Objective, ObjectiveState } from "old_objective/objective"
import { Procedural } from "old_objective/procedural"
import { spawnPriorityLow } from "old_objective/spawn/spawn_creep_objective"
import { Process, processLog, ProcessState } from "process/process"
import { CreepName } from "prototype/creep"
import { generateCodename, generateUniqueId } from "utility/unique_id"
import { CreepType } from "_old/creep"

type Season3War11353ProcessCreepType = CreepType.SCOUT | CreepType.DECOY | CreepType.WORKER

const ownedRoomName = "W27S26"
const targetRoomName = "W28S17"
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

    const [spawningCreepNames, scouts, decoys, dismantlers] = this.refreshCreeps()

    this.runScouts(scouts, spawningCreepNames.length > 0)
    this.runDecoys(decoys, spawningCreepNames.length > 0)
    this.runDismantler(dismantlers, spawningCreepNames.length > 0)
  }

  // ---- Dismantle ---- //
  private runDismantler(dismantlers: Creep[], isSpawning: boolean): void {
    const room = Game.rooms[targetRoomName]
    const hostileAttackers = ((): Creep[] => {
      if (room == null) {
        return []
      }
      return room.find(FIND_HOSTILE_CREEPS).filter(creep => creep.body.map(b => b.type).includes(ATTACK) && creep.hits >= 100)
    })()

    const hostileTower = ((): StructureTower | null => {
      if (room == null) {
        return null
      }
      return room.find(FIND_HOSTILE_STRUCTURES).filter(structure => structure.structureType === STRUCTURE_TOWER)[0] as StructureTower | null
    })()

    const spawnConstructionSite = ((): ConstructionSite<STRUCTURE_SPAWN> | null => {
      if (room == null) {
        return null
      }
      return room.find(FIND_CONSTRUCTION_SITES).filter(site => site.structureType === STRUCTURE_SPAWN)[0] as ConstructionSite<STRUCTURE_SPAWN> | null
    })()

    const hostileSpawn = ((): StructureSpawn | null => {
      if (room == null) {
        return null
      }
      return room.find(FIND_HOSTILE_SPAWNS)[0]
    })()

    const ignoreStructureTypes: StructureConstant[] = [
      STRUCTURE_CONTROLLER,
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
    ]
    const hostileStructures = ((): AnyStructure[] => {
      if (room == null) {
        return []
      }
      return room.find(FIND_HOSTILE_STRUCTURES).filter(structure => ignoreStructureTypes.includes(structure.structureType) !== true)
    })()


    dismantlers.forEach(creep => {
      if (creep.room.name !== targetRoomName) {
        creep.moveToRoom(targetRoomName)
        return
      }

      const hostileAttacker = creep.pos.findInRange(hostileAttackers, 3)[0]
      if (hostileAttacker != null) {
        const path = PathFinder.search(creep.pos, hostileAttacker.pos, {
          flee: true,
          maxRooms: 1,
        })
        creep.moveByPath(path.path)
        return
      }

      if (hostileTower != null) {
        if (creep.dismantle(hostileTower) !== OK) {
          creep.moveTo(hostileTower, { reusePath: 0 })
        }
        return
      }

      if (hostileSpawn != null) {
        if (creep.dismantle(hostileSpawn) !== OK) {
          creep.moveTo(hostileSpawn, { reusePath: 0 })
        }
        return
      }

      if (spawnConstructionSite != null) {
        creep.moveTo(spawnConstructionSite, { reusePath: 0 })
        return
      }

      if (hostileStructures[0] != null) {
        if (creep.dismantle(hostileStructures[0]) !== OK) {
          creep.moveTo(hostileStructures[0], { reusePath: 0 })
        }
        return
      }
    })

    const dismantlersNeeded = 3 - dismantlers.length
    if (isSpawning !== true && dismantlersNeeded > 0) {
      for (let i = 0; i < dismantlersNeeded; i += 1) {
        // this.addCreep(CreepType.WORKER)
      }
    }
  }

  // ---- Decoy ---- //
  private runDecoys(decoys: Creep[], isSpawning: boolean): void {
    const room = Game.rooms[targetRoomName]

    const hostileCreeps = ((): Creep[] => {
      if (room == null) {
        return []
      }
      return room.find(FIND_HOSTILE_CREEPS)
    })()

    const hostileAttackers = ((): Creep[] => {
      if (room == null) {
        return []
      }
      return room.find(FIND_HOSTILE_CREEPS).filter(creep => creep.body.map(b => b.type).includes(ATTACK))
    })()
    const highHpAttackers = hostileAttackers.filter(creep => creep.hits >= 100)

    // const attackerExistsInRoom = ((): boolean => {
    //   if (room == null) {
    //     return false
    //   }
    //   let exists = false
    //   hostileAttackers.forEach(creep => {
    //     if (creep.pos.y > 25) {
    //       exists = true
    //     }
    //   })
    //   return exists
    // })()
    // const decoyExistsInRoom = ((): boolean => {
    //   let exists = false
    //   decoys.forEach(creep => {
    //     if (creep.room.name === targetRoomName) {
    //       exists = true
    //     }
    //   })
    //   return exists

    // })()

    const hostileTower = ((): StructureTower | null => {
      if (room == null) {
        return null
      }
      return room.find(FIND_HOSTILE_STRUCTURES).filter(structure => structure.structureType === STRUCTURE_TOWER)[0] as StructureTower | null
    })()

    const hostileSpawn = ((): StructureSpawn | null => {
      if (room == null) {
        return null
      }
      return room.find(FIND_HOSTILE_SPAWNS)[0]
    })()

    const ignoreStructureTypes: StructureConstant[] = [
      STRUCTURE_CONTROLLER,
      STRUCTURE_WALL,
      STRUCTURE_RAMPART,
    ]
    const hostileStructures = ((): AnyStructure[] => {
      if (room == null) {
        return []
      }
      return room.find(FIND_HOSTILE_STRUCTURES).filter(structure => ignoreStructureTypes.includes(structure.structureType) !== true)
    })()

    decoys.forEach(creep => {
      if (creep.room.name !== targetRoomName) {
        creep.moveToRoom(targetRoomName)
        return
      }

      const nearHostile = creep.pos.findInRange(highHpAttackers, 1)[0]
      if (nearHostile != null) {
        creep.attack(nearHostile)
        return
      }

      const hostileCreep = creep.pos.findClosestByPath(hostileCreeps)
      if (hostileCreep != null) {
        if (creep.attack(hostileCreep) !== OK) {
          creep.moveTo(hostileCreep, {reusePath: 0})
        }
        return
      }

      if (hostileTower != null) {
        if (creep.attack(hostileTower) !== OK) {
          creep.moveTo(hostileTower, { reusePath: 0 })
        }
        return
      }

      if (hostileSpawn != null) {
        if (creep.attack(hostileSpawn) !== OK) {
          creep.moveTo(hostileSpawn, { reusePath: 0 })
        }
        return
      }

      if (hostileStructures[0] != null) {
        if (creep.attack(hostileStructures[0]) !== OK) {
          creep.moveTo(hostileStructures[0], { reusePath: 0 })
        }
        return
      }

      //   if (creep.room.name === targetRoomName) {
      //     if (creep.pos.x === 0) {
      //       creep.move(RIGHT)
      //       return
      //     } else if (creep.pos.x === 49) {
      //       creep.move(LEFT)
      //       return
      //     } else if (creep.pos.y === 0) {
      //       creep.move(BOTTOM)
      //       return
      //     } else if (creep.pos.y === 49) {
      //       creep.move(TOP)
      //       return
      //     }

      //     const nearHostile = creep.pos.findInRange(highHpAttackers, 1)[0]
      //     if (nearHostile != null) {
      //       creep.attack(nearHostile)
      //     }

      //     if (hostileTower != null) {
      //       if (creep.attack(hostileTower) !== OK) {
      //         creep.moveTo(hostileTower, {reusePath: 0})
      //       }
      //     }

      //     return
      //   }

      //   if (creep.room.name === "W23S26") {
      //     if (attackerExistsInRoom === false && decoyExistsInRoom === false) {
      //       creep.moveToRoom(targetRoomName)
      //       return
      //     }
      //     creep.moveTo(11, 2)
      //     return
      //   }

    //   if (["W27S26", "W27S27", "W27S28", "W26S28", "W26S29"].includes(creep.room.name) === true) {
    //     creep.moveToRoom("W26S30")
    //     return
    //   }
    //   if (["W26S30", "W25S30"].includes(creep.room.name) === true) {
    //     creep.moveToRoom("W24S30")
    //     return
    //   }
    //   if (["W26S30", "W25S30"].includes(creep.room.name) === true) {
    //     creep.moveToRoom("W24S30")
    //     return
    //   }
    //   if (["W24S30"].includes(creep.room.name) === true) {
    //     creep.moveToRoom("W24S29")
    //     return
    //   }
    //   if (["W24S29", "W23S29"].includes(creep.room.name) === true) {
    //     creep.moveToRoom("W22S29")
    //     return
    //   }
    //   creep.moveToRoom("W23S26")
    }
    )

    const decoysNeeded = 3 - decoys.length
    if (isSpawning !== true && decoysNeeded > 0) {
      for (let i = 0; i < decoysNeeded; i += 1) {
        // this.addCreep(CreepType.DECOY)
      }
    }
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

        creep.moveTo(15, 29)
        return
      }

      if (creep.task != null) {
        creep.task.run(creep)
      } else {
        const position = nonTargetedPositions.shift() ?? scoutTargets[0]
        creep.task = new ScoutTask(Game.time, position)
        creep.task.run(creep)
      }
    })

    // if (isSpawning !== true) {
    //   for (let i = 0; i < nonTargetedPositions.length; i += 1) {
    //     this.addCreep(CreepType.SCOUT)
    //   }
    // }
  }

  // ---- Targeting ---- //


  // ---- Spawn ---- //
  /**
   * @returns [spawningCreepNames, scouts, decoys, dismantlers]
   */
  private refreshCreeps(): [CreepName[], Creep[], Creep[], Creep[]] {
    const scouts: Creep[] = []
    const decoys: Creep[] = []
    const dismantlers: Creep[] = []
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
        case CreepType.DECOY:
          decoys.push(creep)
          break
        case CreepType.WORKER:
          dismantlers.push(creep)
          break
        default: {
          const body = creep.body.map(b => b.type)
          if (body.includes(ATTACK) === true) {
            decoys.push(creep)
            creep.memory.type = CreepType.DECOY
            break
          }
          if (body.includes(WORK) === true) {
            dismantlers.push(creep)
            creep.memory.type = CreepType.WORKER
            break
          }
          scouts.push(creep)
          creep.memory.type = CreepType.SCOUT
          break
        }
        }
        return
      }
      if (spawningCreepNames.includes(creepName) === true) {
        return
      }
      diedCreepNames.push(creepName)
    })

    this.creepName = this.creepName.filter(creepName => diedCreepNames.includes(creepName) !== true)

    return [spawningCreepNames, scouts, decoys, dismantlers]
  }

  private addCreep(creepType: Season3War11353ProcessCreepType): void {
    const body = ((): BodyPartConstant[] => {
      switch (creepType) {
      case CreepType.SCOUT:
        return [MOVE]
      case CreepType.DECOY:
        return [MOVE, MOVE, MOVE, MOVE, MOVE, ATTACK]
      case CreepType.WORKER:
        return [MOVE, MOVE, MOVE, MOVE, MOVE, WORK]
      }
    })()

    const creepName = generateUniqueId(this.codename)
    const creepProvider = new SingleCreepProviderObjective(
      Game.time,
      [],
      creepName,
      {
        spawnRoomName: ownedRoomName,
        requestingCreepBodyParts: body,
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

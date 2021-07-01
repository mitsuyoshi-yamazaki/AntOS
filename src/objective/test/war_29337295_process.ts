import { AttackTask } from "game_object_task/creep_task/attack_task"
import { BuildTask } from "game_object_task/creep_task/build_task"
import { DismantleTask } from "game_object_task/creep_task/dismantle_task"
import { HarvestEnergyTask } from "game_object_task/creep_task/harvest_energy_task"
import { HealTask } from "game_object_task/creep_task/heal_task"
import { RangedAttackTask } from "game_object_task/creep_task/ranged_attack_task"
import { ScoutTask } from "game_object_task/creep_task/scout_task"
import { UpgradeControllerTask } from "game_object_task/creep_task/upgrade_controller_task"
import { SingleCreepProviderObjective } from "objective/creep_provider/single_creep_provider_objective"
import { decodeObjectiveFrom, Objective, ObjectiveState } from "objective/objective"
import { Procedural } from "objective/procedural"
import { Process, processLog, ProcessState } from "objective/process"
import { spawnPriorityLow } from "objective/spawn/spawn_creep_objective"
import { MessageObserver } from "os/infrastructure/message_observer"
import { CreepName } from "prototype/creep"
import { RoomName } from "prototype/room"
import { getCachedPathFor } from "script/pathfinder"
import { generateCodename, generateUniqueId } from "utility/unique_id"
import { CreepType } from "_old/creep"

const portalExitRoomName = "W50S30"
const ownedRoomName = "W51S29"
const enemyBaseRoomName = "W48S27"
const sourceIds: Id<Source>[] = [
  "5bbcaa559099fc012e6312b9",
  "5bbcaa559099fc012e6312ba",
] as Id<Source>[]
const attackerWaitingPosition = new RoomPosition(40, 25, ownedRoomName)
const blockedSourceId = "5bbcaa559099fc012e6312b9" as Id<Source>
const scoutRoomNames: RoomName[] = [
  "W50S29",
  "W50S30",
]

export interface War29337295ProcessState extends ProcessState {
  /** target id */
  ti: Id<Creep | AnyStructure> | null

  /** creep */
  cr: {
    /** attacker names */
    a: CreepName[]

    /** ranged attacker names */
    ra: CreepName[]

    /** scout names */
    s: CreepName[]

    /** worker names */
    w: CreepName[]
  }

  /** child objective states */
  s: ObjectiveState[]

  /** target enemy room name */
  r: RoomName
}

// - [ ] 行った状況を記録しておく
// Game.io("launch War29337295Process")
// Game.io("launch InterShardCreepDelivererProcess portal_room_name=W50S30 parent_room_name=W51S29 shard_name=shard3 creep_type=heavy_attacker")
// Game.getObjectById("5b994d9e0417171556aa96d7").send(RESOURCE_CATALYZED_KEANIUM_ALKALIDE, 2000, "W51S29")
// Game.check_resources(RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
export class War29337295Process implements Process, Procedural, MessageObserver {
  private readonly codename = generateCodename(this.constructor.name, this.launchTime)

  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
    private targetId: Id<Creep | AnyStructure> | null,
    private attackerNames: CreepName[],
    private rangedAttackerNames: CreepName[],
    private scoutNames: CreepName[],
    private workerNames: CreepName[],
    private childObjectives: Objective[],
    private targetEnemyRoomName: RoomName,
  ) { }

  public encode(): War29337295ProcessState {
    return {
      t: "War29337295Process",
      l: this.launchTime,
      i: this.processId,
      ti: this.targetId,
      cr: {
        a: this.attackerNames,
        ra: this.rangedAttackerNames,
        s: this.scoutNames,
        w: this.workerNames,
      },
      s: this.childObjectives.map(objective => objective.encode()),
      r: this.targetEnemyRoomName,
    }
  }

  public static decode(state: War29337295ProcessState): War29337295Process {
    const objectives = (state.s ?? []).reduce((result: Objective[], current: ObjectiveState): Objective[] => {
      const objective = decodeObjectiveFrom(current)
      if (objective != null) {
        result.push(objective)
      }
      return result
    }, [] as Objective[])
    return new War29337295Process(state.l, state.i, state.ti, state.cr.a, state.cr.ra, state.cr.s, state.cr.w, objectives, state.r ?? enemyBaseRoomName)
  }

  public didReceiveMessage(message: string): string {
    this.targetEnemyRoomName = message
    return `Override target enemy room name to ${message}`
  }

  public runOnTick(): void {
    const portalExitRoom = Game.rooms[portalExitRoomName]
    if (portalExitRoom != null) {
      this.receiveCreeps(portalExitRoom)
    }

    const [updatedAttackerNames, attackers] = this.getCreeps(this.attackerNames)
    this.attackerNames = updatedAttackerNames
    attackers.forEach(creep => this.runAttacker(creep))

    const [updatedRangedAttackerNames, rangedAttackers] = this.getCreeps(this.rangedAttackerNames)
    this.rangedAttackerNames = updatedRangedAttackerNames
    rangedAttackers.forEach(creep => this.runRangedAttacker(creep))

    // this.runWorkers()
    this.runDismantlers()
    this.runScouts()
  }

  private getCreeps(creepNames: CreepName[]): [CreepName[], Creep[]] {
    const creeps: Creep[] = []
    const diedCreeps: CreepName[] = []
    creepNames.forEach(name => {
      const creep = Game.creeps[name]
      if (creep != null) {
        creeps.push(creep)
        return
      }
      diedCreeps.push(name)
    })
    const updatedCreepNames = creepNames.filter(name => diedCreeps.includes(name) !== true)
    return [updatedCreepNames, creeps]
  }

  // ---- Ranged Attack ---- //
  private runRangedAttacker(creep: Creep): void {
    creep.heal(creep)

    const getHostileCreep = ((range: number): Creep | null => {
      return creep.pos.findInRange(FIND_HOSTILE_CREEPS, range).filter(c => {
        if (Game.isEnemy(c.owner) !== true) {
          return false
        }
        const body = c.body.map(b => b.type)
        if (body.includes(ATTACK) === true) {
          return true
        }
        if (body.includes(RANGED_ATTACK) === true) {
          return true
        }
        return false
      })[0]
    })

    if (creep.room.name === this.targetEnemyRoomName) {
      const hostileCreep = getHostileCreep(2)
      if (hostileCreep == null) {
        if (creep.task?.run(creep) === "in progress") {
          return
        }
        const tower = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: {structureType: STRUCTURE_TOWER}}) as StructureTower | null
        if (tower != null) {
          creep.task = new RangedAttackTask(Game.time, tower)
          processLog(this, `Creep ${creep.name} ranged attack tower ${tower.id}`)
          return
        }
        const spawn = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } }) as StructureSpawn | null
        if (spawn != null) {
          creep.task = new RangedAttackTask(Game.time, spawn)
          processLog(this, `Creep ${creep.name} ranged attack spawn ${spawn.id}`)
          return
        }
        const hostileCreep = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
        if (hostileCreep != null) {
          creep.task = new RangedAttackTask(Game.time, hostileCreep)
          processLog(this, `Creep ${creep.name} ranged attack creep ${hostileCreep.id}`)
          return
        }
        if (creep.room.storage != null) {
          creep.task = new RangedAttackTask(Game.time, creep.room.storage)
          processLog(this, `Creep ${creep.name} ranged attack storage ${creep.room.storage.id}`)
          return
        }
        if (creep.room.terminal != null) {
          creep.task = new RangedAttackTask(Game.time, creep.room.terminal)
          processLog(this, `Creep ${creep.name} ranged attack terminal ${creep.room.terminal.id}`)
          return
        }
        const extension = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_EXTENSION } }) as StructureExtension | null
        if (extension != null) {
          creep.task = new RangedAttackTask(Game.time, extension)
          processLog(this, `Creep ${creep.name} ranged attack extension ${extension.id}`)
          return
        }
        creep.say("🙂")
        return
      } else {
        creep.task = null
        creep.rangedAttack(hostileCreep)

        const path = PathFinder.search(creep.pos, hostileCreep.pos, {
          flee: true,
          maxRooms: 1,
        })
        creep.moveByPath(path.path)
      }
    } else {
      const hostileCreep = getHostileCreep(3)
      if (hostileCreep != null) {
        creep.rangedAttack(hostileCreep)
      } else {
        if (creep.task != null) {
          if (creep.task.run(creep) !== "in progress") {
            creep.task = null
          }
          return
        } else {
          creep.moveToRoom(this.targetEnemyRoomName)
        }
      }
    }
  }

  // ---- Dismantle ---- //
  private runDismantlers(): void {
    const [updatedDismantlerNames, dismantler] = this.getCreeps(this.workerNames)
    this.workerNames = updatedDismantlerNames
    dismantler.forEach(creep => this.runDismantler(creep))
  }

  private runDismantler(creep: Creep): void {
    if (creep.task != null) {
      if (creep.task.run(creep) === "in progress") {
        return
      }
      creep.task = null
    }

    const targetRoomName = this.targetEnemyRoomName
    if (creep.room.name !== targetRoomName) {
      creep.moveToRoom(targetRoomName)
      return
    }

    if (creep.pos.x === 0) {
      creep.move(RIGHT)
      return
    } else if (creep.pos.x === 49) {
      creep.move(LEFT)
      return
    } else if (creep.pos.y === 0) {
      creep.move(BOTTOM)
      return
    } else if (creep.pos.y === 49) {
      creep.move(TOP)
      return
    }

    // const targetWall = Game.getObjectById("5e11ab0c8e7f2e59bb7bfdb0") as StructureWall | null
    // if (targetWall != null) {
    //   creep.task = new DismantleTask(Game.time, targetWall)
    //   return
    // }

    const excludes: StructureConstant[] = [STRUCTURE_WALL, STRUCTURE_RAMPART, STRUCTURE_CONTROLLER]
    const target = creep.room.find(FIND_HOSTILE_STRUCTURES).filter(structure => excludes.includes(structure.structureType) !== true)[0]
    if (target) {
      creep.task = new DismantleTask(Game.time, target)
    } else {
      creep.say("😴")
    }
  }

  // ---- Attack ---- //
  private runAttacker(creep: Creep): void {
    if (creep.task == null && creep.room.name !== ownedRoomName) {
      creep.moveToRoom(ownedRoomName)
      return
    }
    if (creep.task?.run(creep) === "in progress") {
      return
    }

    const target = ((): Creep | AnyStructure | null => {
      if (this.targetId != null) {
        const storedTarget = Game.getObjectById(this.targetId)
        if (storedTarget == null) {
          this.targetId = null
        } else if (creep.room.name === storedTarget.room.name) {
          return storedTarget
        }
      }
      const nextTarget = this.nextTarget(creep)
      if (nextTarget != null) {
        this.targetId = nextTarget.id
        return nextTarget
      }
      return null
    })()

    if (target == null) {
      creep.task = new HealTask(Game.time, creep)

      if (creep.pos.inRangeTo(attackerWaitingPosition, 3) !== true) {
        creep.moveTo(attackerWaitingPosition, { reusePath: 0 })
        return
      }
      const source = Game.getObjectById(blockedSourceId)
      if (source == null) {
        return
      }
      const cachedPath = getCachedPathFor(source)
      if (cachedPath == null) {
        return
      }
      if (cachedPath.some(position => position.x === creep.pos.x && position.y === creep.pos.y) === true) {
        this.moveToRandomDirection(creep)
        return
      }
      return
    }

    processLog(this, `Attacker ${creep.name} new target assigned: ${target.id}`)
    creep.task = new AttackTask(Game.time, target)
    creep.task.run(creep)
  }

  private moveToRandomDirection(creep: Creep): void {
    const directions: DirectionConstant[] = [
      TOP,
      TOP_LEFT,
      LEFT,
      BOTTOM_LEFT,
      BOTTOM,
      BOTTOM_RIGHT,
      RIGHT,
      TOP_RIGHT,
    ]
    const direction: DirectionConstant = directions[Math.floor(Math.random() * directions.length)]
    creep.move(direction)
  }

  private nextTarget(creep: Creep): Creep | AnyStructure | null {
    return creep.room.find(FIND_HOSTILE_CREEPS)[0]
  }

  // ---- Run Worker ---- //
  private runWorkers(): void {
    if (this.workerNames.length <= 0) {
      return
    }

    const shouldTakeOver = ((): boolean => {
      const room = Game.rooms[ownedRoomName]
      if (room == null) {
        return false
      }
      if (room.find(FIND_MY_SPAWNS).length > 0) {
        return true
      }
      return false
    })()

    const [updatedWorkerNames, workers] = this.getCreeps(this.workerNames)
    this.workerNames = updatedWorkerNames

    if (shouldTakeOver === true) {
      workers.forEach(creep => {
        if (creep.room.name !== ownedRoomName) {
          creep.moveToRoom(ownedRoomName)
          return
        }
        const index = this.workerNames.indexOf(creep.name)
        if (index < 0) {
          return
        }
        this.workerNames.splice(index, 1)
      })
    } else {
      const sources: Source[] = []
      sourceIds.forEach(sourceId => {
        const source = Game.getObjectById(sourceId)
        if (source != null) {
          sources.push(source)
        }
      })

      workers.forEach(creep => this.runWorker(creep, sources))
    }
  }

  private runWorker(creep: Creep, sources: Source[]): void {
    if (creep.task?.run(creep) === "in progress") {
      return
    }

    if (creep.room.name === ownedRoomName) {
      creep.memory.type = CreepType.TAKE_OVER
    }

    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) <= 0) {
      const source = this.getSourceToAssign(sources, creep.pos)
      if (source != null) {
        creep.task = new HarvestEnergyTask(Game.time, source)
        return
      } else {
        creep.task = null
        return
      }
    }
    // const structureToCharge = this.getStructureToCharge(chargeableStructures, creep.pos)
    // if (structureToCharge != null) {
    //   creep.task = new TransferToStructureTask(Game.time, structureToCharge)
    // } else {
    if (creep.room.name === ownedRoomName) {
      const constructionSite = creep.room.find(FIND_MY_CONSTRUCTION_SITES)[0]
      if (constructionSite != null) {
        creep.task = new BuildTask(Game.time, constructionSite)
        return
      }
    }
    if (creep.room.controller != null) {
      creep.task = new UpgradeControllerTask(Game.time, creep.room.controller)
      return
    }
    // }
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

  // ---- Scout ---- //
  private runScouts(): void {
    const creepProviders = this.childObjectives.filter(objective => objective instanceof SingleCreepProviderObjective) as SingleCreepProviderObjective[]
    creepProviders.forEach(objective => {
      if (!(objective instanceof SingleCreepProviderObjective)) {
        return
      }

      const result = objective.progress()
      switch (result.objectProgressType) {
      case "in progress":
        return
      case "succeeded":
        this.removeChildObjective(objective)
        this.scoutNames.push(result.result.name)
        return
      case "failed":
        this.removeChildObjective(objective)
        return
      }
    })

    const [updatedScoutNames, scouts] = this.getCreeps(this.scoutNames)
    this.scoutNames = updatedScoutNames

    const targetedRoomNames: RoomName[] = []
    scouts.forEach(creep => {
      if (!(creep.task instanceof ScoutTask)) {
        return
      }
      targetedRoomNames.push(creep.task.roomName)
    })
    const nonTargetedRoomNames: RoomName[] = []

    const isSpawning = creepProviders.length > 0
    scoutRoomNames.forEach(roomName => {
      const room = Game.rooms[roomName]
      if (room != null) {
        return
      }
      if (isSpawning === true) {
        return
      }
      if (targetedRoomNames.includes(roomName) === true) {
        return
      }
      nonTargetedRoomNames.push(roomName)
    })

    const assigned = false as boolean

    // scouts.forEach(creep => {
    //   if (creep.task == null) {
    //     creep.task = new ScoutTask(Game.time, "W48S28")
    //   }
    //   // if (creep.task == null) {
    //   //   if (nonTargetedRoomNames[0] != null) {
    //   //     creep.task = new ScoutTask(Game.time, nonTargetedRoomNames[0])
    //   //     assigned = true
    //   //   } else {
    //   //     creep.task = new ScoutTask(Game.time, scoutRoomNames[0])
    //   //   }
    //   // }
    //   if (Game.cpu.bucket > 5000) {
    //     creep.task.run(creep)
    //   }
    // })

    if (assigned !== true && nonTargetedRoomNames.length > 0) {
      // this.addScoutTo()
    }
  }

  private addScoutTo(): void {
    const creepName = generateUniqueId(this.codename)
    const creepProvider = new SingleCreepProviderObjective(
      Game.time,
      [],
      creepName,
      {
        spawnRoomName: ownedRoomName,
        requestingCreepBodyParts: [MOVE],
        priority: spawnPriorityLow,
      }
    )
    this.childObjectives.push(creepProvider)
    processLog(this, "Added scout")
  }

  private removeChildObjective(objective: Objective): void {
    const index = this.childObjectives.indexOf(objective)
    if (index < 0) {
      return
    }
    this.childObjectives.splice(index, 1)
  }

  // ---- Receive Creeps ---- //
  private receiveCreeps(room: Room): void {
    const unassignedCreeps = room.find(FIND_MY_CREEPS).filter(creep => creep.memory.type == null || creep.memory.type === CreepType.TAKE_OVER)
    unassignedCreeps.forEach(creep => {
      this.assignCreep(creep)
    })
  }

  private assignCreep(creep: Creep): void {
    const body = creep.body.map(b => b.type)
    if (body.includes(ATTACK) === true) {
      this.attackerNames.push(creep.name)
      creep.memory.type = CreepType.ATTACKER
      processLog(this, `Assign creep ${creep.name} to attacker`)
      return
    }
    if (body.includes(RANGED_ATTACK) === true) {
      this.rangedAttackerNames.push(creep.name)
      creep.memory.type = CreepType.RANGED_ATTACKER
      processLog(this, `Assign creep ${creep.name} to ranged attacker`)
      return
    }
    if (body.includes(WORK) === true) {
      this.workerNames.push(creep.name)
      creep.memory.type = CreepType.WORKER
      processLog(this, `Assign creep ${creep.name} to worker`)
      return
    }
    this.scoutNames.push(creep.name)
    creep.memory.type = CreepType.SCOUT
    processLog(this, `Assign creep ${creep.name} to scout`)
  }
}

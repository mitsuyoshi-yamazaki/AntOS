import { AttackTask } from "game_object_task/creep_task/attack_task"
import { BuildTask } from "game_object_task/creep_task/build_task"
import { HarvestEnergyTask } from "game_object_task/creep_task/harvest_energy_task"
import { HealTask } from "game_object_task/creep_task/heal_task"
import { UpgradeControllerTask } from "game_object_task/creep_task/upgrade_controller_task"
import { Procedural } from "objective/procedural"
import { Process, processLog, ProcessState } from "objective/process"
import { CreepName } from "prototype/creep"
import { getCachedPathFor } from "script/pathfinder"
import { CreepType } from "_old/creep"

const portalExitRoomName = "W50S30"
const ownedRoomName = "W51S29"
const sourceIds: Id<Source>[] = [
  "5bbcaa559099fc012e6312b9",
  "5bbcaa559099fc012e6312ba",
] as Id<Source>[]
const attackerWaitingPosition = new RoomPosition(40, 25, ownedRoomName)
const blockedSourceId = "5bbcaa559099fc012e6312b9" as Id <Source>

export interface WarProcessState extends ProcessState {
  /** target id */
  ti: Id<Creep | AnyStructure> | null

  /** creep */
  cr: {
    /** attacker names */
    a: CreepName[]

    /** scout names */
    s: CreepName[]

    /** worker names */
    w: CreepName[]
  }
}

// Game.io("launch WarProcess")
// Game.io("launch InterShardCreepDelivererProcess portal_room_name=W50S30 parent_room_name=W51S29 shard_name=shard3 creep_type=heavy_attacker")
// Game.getObjectById("5b994d9e0417171556aa96d7").send(RESOURCE_CATALYZED_KEANIUM_ALKALIDE, 2000, "W51S29")
// Game.check_resources(RESOURCE_CATALYZED_KEANIUM_ALKALIDE)
export class WarProcess implements Process, Procedural {
  public constructor(
    public readonly launchTime: number,
    public readonly processId: number,
    private targetId: Id<Creep | AnyStructure> | null,
    private attackerNames: CreepName[],
    private scoutNames: CreepName[],
    private workerNames: CreepName[],
  ) { }

  public encode(): WarProcessState {
    return {
      t: "WarProcess",
      l: this.launchTime,
      i: this.processId,
      ti: this.targetId,
      cr: {
        a: this.attackerNames,
        s: this.scoutNames,
        w: this.workerNames,
      },
    }
  }

  public static decode(state: WarProcessState): WarProcess {
    return new WarProcess(state.l, state.i, state.ti, state.cr.a, state.cr.s, state.cr.w)
  }

  public runOnTick(): void {
    const portalExitRoom = Game.rooms[portalExitRoomName]
    if (portalExitRoom != null) {
      this.receiveCreeps(portalExitRoom)
    }

    const [updatedAttackerNames, attackers] = this.getCreeps(this.attackerNames)
    this.attackerNames = updatedAttackerNames
    attackers.forEach(creep => this.runAttacker(creep))

    this.runWorkers()
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

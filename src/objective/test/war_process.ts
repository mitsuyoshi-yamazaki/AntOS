import { ErrorMapper } from "error_mapper/ErrorMapper"
import { AttackTask } from "game_object_task/creep_task/attack_task"
import { Procedural } from "objective/procedural"
import { Process, processLog, ProcessState } from "objective/process"
import { CreepName } from "prototype/creep"
import { CreepType } from "_old/creep"

const portalExitRoomName = "W50S30"
const ownedRoomName = "W51S29"

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

    const [updatedWorkerNames, workers] = this.getCreeps(this.workerNames)
    this.workerNames = updatedWorkerNames
    workers.forEach(creep => this.runWorker(creep))
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
    if (creep.room.name !== ownedRoomName) {
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
      return
    }
    processLog(this, `Attacker ${creep.name} new target assigned: ${target.id}`)
    creep.task = new AttackTask(Game.time, target)
    creep.task.run(creep)
  }

  private nextTarget(creep: Creep): Creep | AnyStructure | null {
    return creep.room.find(FIND_HOSTILE_CREEPS)[0]
  }

  // ---- Run Worker ---- //
  private runWorker(creep: Creep): void {

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

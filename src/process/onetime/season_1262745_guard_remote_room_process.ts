import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { defaultMoveToOptions } from "prototype/creep"
import { randomDirection } from "utility/constants"

export type Season1262745GuardRemoteRoomProcessCreepType = "ranged attacker"// | "attacker"

// const attackerRole: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
// const attackerBody: BodyPartConstant[] = [
//   MOVE, MOVE, MOVE, MOVE, MOVE,
//   ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
//   ATTACK, ATTACK, ATTACK,
//   MOVE, MOVE, MOVE, MOVE, MOVE,
//   MOVE, MOVE, MOVE,
//   MOVE, MOVE, MOVE, MOVE, MOVE,
//   MOVE, MOVE, MOVE, MOVE,
//   HEAL, HEAL, HEAL, HEAL, HEAL,
//   HEAL, HEAL, HEAL, HEAL,
// ]

const rangedAttackerRole: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
const rangedAttackerBody: BodyPartConstant[] = [
  TOUGH, TOUGH, TOUGH,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE,
  RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
  RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
  MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL,
]

export interface Season1262745GuardRemoteRoomProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  targetId: Id<AnyStructure | AnyCreep> | null
  creepType: Season1262745GuardRemoteRoomProcessCreepType
  numberOfCreeps: number
}

// Game.io("launch -l Season1262745GuardRemoteRoomProcess room_name=W14S28 target_room_name=W6S29 waypoints=W14S30,W6S30")
// Game.io("launch -l Season1262745GuardRemoteRoomProcess room_name=W3S24 target_room_name=W6S27 waypoints=W3S25,W6S25")
// Game.io("launch -l Season1262745GuardRemoteRoomProcess room_name=W3S24 target_room_name=W3S26 waypoints=W3S25 creeps=1")
export class Season1262745GuardRemoteRoomProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly creepRole: CreepRole[]
  private readonly creepBody: BodyPartConstant[]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly creepType: Season1262745GuardRemoteRoomProcessCreepType,
    private readonly numberOfCreeps: number,
    private readonly targetId: Id<AnyStructure | AnyCreep> | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    switch (this.creepType) {
    case "ranged attacker":
      this.creepRole = rangedAttackerRole
      this.creepBody = rangedAttackerBody
    }
  }

  public encode(): Season1262745GuardRemoteRoomProcessState {
    return {
      t: "Season1262745GuardRemoteRoomProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      creepType: this.creepType,
      numberOfCreeps: this.numberOfCreeps,
      targetId: this.targetId,
    }
  }

  public static decode(state: Season1262745GuardRemoteRoomProcessState): Season1262745GuardRemoteRoomProcess {
    return new Season1262745GuardRemoteRoomProcess(state.l, state.i, state.p, state.tr, state.w, state.creepType, state.numberOfCreeps ?? 2, state.targetId)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], creepType: Season1262745GuardRemoteRoomProcessCreepType, numberOfCreeps: number): Season1262745GuardRemoteRoomProcess {
    return new Season1262745GuardRemoteRoomProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, creepType, numberOfCreeps, null)
  }

  public processShortDescription(): string {
    return `${roomLink(this.targetRoomName)} ${this.creepType}`
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)

    if (creeps[0] == null || (creeps.length < this.numberOfCreeps && creeps[0].ticksToLive != null && creeps[0].ticksToLive < 900)) {
      const targetRoom = Game.rooms[this.targetRoomName]
      if (targetRoom == null || targetRoom.find(FIND_MY_STRUCTURES, { filter: {structureType: STRUCTURE_TOWER}}).length < 2) {
        this.requestCreep()
      }
    }

    switch (this.creepType) {
    case "ranged attacker":
      creeps.forEach(creep => this.runRangedAttacker(creep))
      break
    }
  }

  private requestCreep(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: this.creepRole,
      body: this.creepBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runRangedAttacker(creep: Creep): void {
    const movement = this.attackNearbyHostile(creep)
    creep.heal(creep)

    if (movement.moved === true) {
      return
    }

    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      const roomDistance = Game.map.getRoomLinearDistance(creep.room.name, this.targetRoomName)
      const waypoints: RoomName[] = roomDistance <= 1 ? [] : this.waypoints
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, waypoints)
      return
    }

    if (movement.attackedTarget != null) {
      creep.moveTo(movement.attackedTarget)
      return
    }

    const {moved} = this.runSingleAttacker(creep)
    if (moved === true) {
      return
    }

    const waitingTarget = creep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })[0] ?? creep.room.controller
    if (waitingTarget == null) {
      return
    }
    const waitingRange = 5
    if (creep.pos.getRangeTo(waitingTarget.pos) <= waitingRange) {
      creep.move(randomDirection(this.launchTime))
      return
    }
    const moveToOptions = defaultMoveToOptions()
    moveToOptions.range = waitingRange
    creep.moveTo(waitingTarget, moveToOptions)
  }

  private runSingleAttacker(creep: Creep): { moved: boolean} {
    const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
    if (target == null) {
      return {moved: false}
    }

    this.rangedAttack(creep, target)
    creep.heal(creep)
    if (target.getActiveBodyparts(ATTACK) > 0 && target.pos.getRangeTo(creep.pos) <= 2) {
      this.fleeFrom(target.pos, creep, 4)
    } else {
      creep.moveTo(target)
    }
    return { moved: true}
  }

  private attackNearbyHostile(creep: Creep): { attackedTarget: Creep | null, moved: boolean } {
    let attackedTarget = null as Creep | null
    let moved = false
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null) {
      this.rangedAttack(creep, closestHostile)
      attackedTarget = closestHostile

      if (closestHostile.getActiveBodyparts(ATTACK) > 0 && closestHostile.pos.getRangeTo(creep) <= 2) {
        this.fleeFrom(closestHostile.pos, creep, 4)
        moved = true
      }
    }
    return { attackedTarget, moved }
  }

  private closestHostile(position: RoomPosition): Creep | null {
    const hostiles = position.findInRange(FIND_HOSTILE_CREEPS, 4)
    if (hostiles.length <= 0) {
      return null
    }
    return hostiles.reduce((lhs, rhs) => {
      return position.getRangeTo(lhs.pos) < position.getRangeTo(rhs.pos) ? lhs : rhs
    })
  }

  private rangedAttack(creep: Creep, target: AnyCreep | AnyStructure): void {
    if (creep.pos.isNearTo(target.pos) === true) {
      creep.rangedMassAttack()
    } else {
      creep.rangedAttack(target)
    }
  }

  private fleeFrom(position: RoomPosition, creep: Creep, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 1,
    })
    creep.moveByPath(path.path)
  }
}

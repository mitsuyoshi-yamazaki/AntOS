import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { GameConstants } from "utility/constants"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"

export type Season1262745GuardRemoteRoomProcessCreepType = "ranged attacker"

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
}

// Game.io("launch -l Season1262745GuardRemoteRoomProcess room_name=W14S28 target_room_name=W6S29 waypoints=W14S30,W6S30")
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
      targetId: this.targetId,
    }
  }

  public static decode(state: Season1262745GuardRemoteRoomProcessState): Season1262745GuardRemoteRoomProcess {
    return new Season1262745GuardRemoteRoomProcess(state.l, state.i, state.p, state.tr, state.w, state.creepType, state.targetId)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], creepType: Season1262745GuardRemoteRoomProcessCreepType): Season1262745GuardRemoteRoomProcess {
    return new Season1262745GuardRemoteRoomProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, creepType, null)
  }

  public processShortDescription(): string {
    return `${roomLink(this.targetRoomName)} ${this.creepType}`
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)

    if (creeps[0] == null || (creeps.length === 1 && creeps[0].ticksToLive != null && creeps[0].ticksToLive < 900)) {
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
      priority: CreepSpawnRequestPriority.High,
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
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    if (movement.attacked === true) {
      return
    }

    const moved = this.runSingleAttacker(creep)

    if (moved !== true && creep.ticksToLive != null && creep.ticksToLive < (GameConstants.creep.life.lifeTime * 0.9)) {
      const spawn = World.rooms.getOwnedRoomObjects(this.targetRoomName)?.activeStructures.spawns[0]
      if (spawn != null) {
        if (spawn.spawning == null && (Game.time % 13) < 6 && spawn.room.energyAvailable >= spawn.room.energyCapacityAvailable) {
          spawn.renewCreep(creep)
        }
        creep.moveTo(spawn, { range: 1 })
      }
    }
  }

  private runSingleAttacker(creep: Creep): boolean {
    const target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS)
    if (target == null) {
      return false
    }

    this.rangedAttack(creep, target)
    creep.heal(creep)
    if (target.getActiveBodyparts(ATTACK) > 0 && target.pos.getRangeTo(creep.pos) <= 2) {
      this.fleeFrom(target.pos, creep, 4)
    } else {
      creep.moveTo(target)
    }
    return true
  }

  private attackNearbyHostile(creep: Creep): { attacked: boolean, moved: boolean } {
    let attacked = false
    let moved = false
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null) {
      this.rangedAttack(creep, closestHostile)
      attacked = true

      if (closestHostile.getActiveBodyparts(ATTACK) > 0 && closestHostile.pos.getRangeTo(creep) <= 2) {
        this.fleeFrom(closestHostile.pos, creep, 4)
        moved = true
      }
    }
    return { attacked, moved }
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

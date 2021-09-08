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
import { randomDirection } from "utility/constants"
import { defaultMoveToOptions } from "prototype/creep"


const rangedAttackerRole: CreepRole[] = [CreepRole.RangedAttacker, CreepRole.Mover]
const rangedAttackerBody: BodyPartConstant[] = [
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL,
]

export interface Season1606052SKHarvesterProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  harvestMineral: boolean
}

// Game.io("launch -l Season1606052SKHarvesterProcess room_name=W3S24 target_room_name=W4S24 waypoints=W4S24")
export class Season1606052SKHarvesterProcess implements Process, Procedural {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private harvestMineral: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1606052SKHarvesterProcessState {
    return {
      t: "Season1606052SKHarvesterProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      harvestMineral: this.harvestMineral,
    }
  }

  public static decode(state: Season1606052SKHarvesterProcessState): Season1606052SKHarvesterProcess {
    return new Season1606052SKHarvesterProcess(state.l, state.i, state.p, state.tr, state.w, state.harvestMineral)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], harvestMineral: boolean): Season1606052SKHarvesterProcess {
    return new Season1606052SKHarvesterProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, harvestMineral)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)

    if (creeps[0] == null || (creeps[0].ticksToLive != null && creeps[0].ticksToLive < 100)) {
      this.requestCreep()
    }

    creeps.forEach(creep => this.runRangedAttacker(creep))
  }

  private requestCreep(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: rangedAttackerRole,
      body: rangedAttackerBody,
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
      const attackedTarget = movement.attackedTarget
      if (attackedTarget.getActiveBodyparts(ATTACK) <= 0 && attackedTarget.pos.isRoomEdge !== true || creep.pos.isNearTo(attackedTarget.pos) !== true) {
        creep.moveTo(movement.attackedTarget)
      }
      return
    }

    const { moved } = this.runSingleAttacker(creep)
    if (moved === true) {
      return
    }

    // TODO: 次のLair
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

  private runSingleAttacker(creep: Creep): { moved: boolean } {
    const target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS)
    if (target == null) {
      const lairs = creep.room.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR } }) as StructureKeeperLair[]
      const keeperLair = lairs.sort((lhs, rhs) => {
        if (lhs.ticksToSpawn == null && rhs.ticksToSpawn == null) {
          return 0
        }
        if (lhs.ticksToSpawn == null) {
          return 1
        }
        if (rhs.ticksToSpawn == null) {
          return -1
        }
        return lhs.ticksToSpawn - rhs.ticksToSpawn
      })[0]
      if (keeperLair != null) {
        creep.moveTo(keeperLair, {maxRooms: 1, maxOps: 500, range: 5})
        return {moved: true}
      }
      return { moved: false }
    }

    this.rangedAttack(creep, target)
    creep.heal(creep)
    if (target.getActiveBodyparts(ATTACK) > 0 && target.pos.getRangeTo(creep.pos) <= 2) {
      this.fleeFrom(target.pos, creep, 4)
    } else {
      if (target.pos.isRoomEdge !== true || creep.pos.isNearTo(target.pos) !== true) {
        creep.moveTo(target)
      }
    }
    return { moved: true }
  }

  private attackNearbyHostile(creep: Creep): { attackedTarget: Creep | null, moved: boolean } {
    let attackedTarget = null as Creep | null
    let moved = false
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null) {
      this.rangedAttack(creep, closestHostile)
      attackedTarget = closestHostile

      if (closestHostile.getActiveBodyparts(ATTACK) > 0) {
        const range = closestHostile.pos.getRangeTo(creep)
        if (range <= 2) {
          this.fleeFrom(closestHostile.pos, creep, 4)
          moved = true
        } else if (range === 3) {
          moved = true
        }
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
  }}

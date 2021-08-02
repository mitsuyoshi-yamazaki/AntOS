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
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "process/process_log"

export interface Season1349943DisturbPowerHarvestingProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** waypoints */
  w: RoomName[]

  patrollRoomNames: RoomName[]
}

// Game.io("launch -l Season1349943DisturbPowerHarvestingProcess room_name=W21S23 waypoints=W20S23 patrol_rooms=W20S20,W30S20")
// Game.io("launch -l Season1349943DisturbPowerHarvestingProcess room_name=W27S26 waypoints=W28S26,W28S25,W30S25 patrol_rooms=W30S20,W20S20")
export class Season1349943DisturbPowerHarvestingProcess implements Process, Procedural {
  public readonly identifier: string
  private readonly codename: string

  private readonly whitelistedUsernames = Memory.gameInfo.sourceHarvestWhitelist || []

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly waypoints: RoomName[],
    public readonly patrollRoomNames: RoomName[],
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.patrollRoomNames.join(",")}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1349943DisturbPowerHarvestingProcessState {
    return {
      t: "Season1349943DisturbPowerHarvestingProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      w: this.waypoints,
      patrollRoomNames: this.patrollRoomNames,
    }
  }

  public static decode(state: Season1349943DisturbPowerHarvestingProcessState): Season1349943DisturbPowerHarvestingProcess {
    return new Season1349943DisturbPowerHarvestingProcess(state.l, state.i, state.p, state.w, state.patrollRoomNames)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, waypoints: RoomName[], patrollRoomNames: RoomName[]): Season1349943DisturbPowerHarvestingProcess {
    return new Season1349943DisturbPowerHarvestingProcess(Game.time, processId, parentRoomName, waypoints, patrollRoomNames)
  }

  public processShortDescription(): string {
    return this.patrollRoomNames.map(roomName => roomLink(roomName)).join(",")
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    if (creeps.length < 1) {
      this.requestCreep()
    }

    creeps.forEach(creep => this.runRangedAttacker(creep))
  }

  private requestCreep(): void {
    const targetRoom = this.waypoints[this.waypoints.length - 1] ?? this.patrollRoomNames[this.patrollRoomNames.length - 1]
    if (targetRoom == null) {
      PrimitiveLogger.programError(`${this.identifier} no room provided ${this.waypoints}, ${this.patrollRoomNames}`)
      return
    }
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.RangedAttacker],
      body: [RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE],
      initialTask: MoveToRoomTask.create(targetRoom, this.waypoints),
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runRangedAttacker(creep: Creep): void {
    const { moved } = this.avoidHostileRangedAttacker(creep)
    const movement = this.attackHostile(creep, moved !== true)

    const shouldPauseTask = (moved === true || movement.moved === true || movement.attackedTarget != null)
    if (creep.v5task?.pause != null) {
      creep.v5task.pause(shouldPauseTask)
    }
    if (creep.v5task == null) {
      const patrollRoomNames = [...this.patrollRoomNames]
      const targetRoom = patrollRoomNames.pop()
      if (targetRoom == null || patrollRoomNames.length < 1) {
        PrimitiveLogger.programError(`${this.identifier} not enough patrollRoomNames ${this.patrollRoomNames}`)
        return
      }
      creep.v5task = MoveToRoomTask.create(targetRoom, patrollRoomNames)
    }
  }

  private avoidHostileRangedAttacker(creep: Creep): { moved: boolean } {
    const hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 6).filter(creep => (creep.getActiveBodyparts(RANGED_ATTACK) > 0))
    const closest = creep.pos.findClosestByRange(hostiles)
    if (closest == null) {
      return {
        moved: false
      }
    }
    this.fleeFrom(closest.pos, creep, 7)
    return {
      moved: true
    }
  }

  private attackHostile(creep: Creep, canMove: boolean): { attackedTarget: Creep | null, moved: boolean } {
    let attackedTarget = null as Creep | null
    let moved = false
    const closestHostile = this.closestHostile(creep)
    if (closestHostile != null) {
      this.rangedAttack(creep, closestHostile)
      attackedTarget = closestHostile
      processLog(this, `Found target ${attackedTarget} in ${roomLink(creep.room.name)}`)

      if (canMove === true) {
        if (closestHostile.getActiveBodyparts(ATTACK) > 0 && closestHostile.pos.getRangeTo(creep) <= 2) {
          this.fleeFrom(closestHostile.pos, creep, 4)
        } else {
          creep.moveTo(closestHostile)
        }
        moved = true
      }
    }
    return { attackedTarget, moved }
  }

  private closestHostile(creep: Creep): Creep | null {
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS).filter(creep => {
      if (this.whitelistedUsernames.includes(creep.owner.username) !== true) {
        return false
      }
      if (creep.getActiveBodyparts(MOVE) <= 0 && creep.getActiveBodyparts(HEAL) <= 0) {
        return
      }
      return creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(CARRY) > 0
    })
    if (hostiles.length <= 0) {
      return null
    }
    return creep.pos.findClosestByRange(hostiles)
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

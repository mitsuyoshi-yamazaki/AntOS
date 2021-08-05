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

type AttackerType = "attacker" | "ranged_attacker" | "large_ranged_attacker"

export interface Season1349943DisturbPowerHarvestingProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** waypoints */
  w: RoomName[]

  patrollRoomNames: RoomName[]
  attackerType: AttackerType
}

// Game.io("launch -l Season1349943DisturbPowerHarvestingProcess room_name=W21S23 waypoints=W20S23 patrol_rooms=W20S20,W30S20 attacker_type=attacker")
// Game.io("launch -l Season1349943DisturbPowerHarvestingProcess room_name=W27S26 waypoints=W28S26,W28S25,W30S25 patrol_rooms=W30S20,W20S20 attacker_type=attacker")
// Game.io("launch -l Season1349943DisturbPowerHarvestingProcess room_name=W24S29 waypoints=W24S30 patrol_rooms=W23S30,W20S30,W20S21 attacker_type=attacker")
// Game.io("launch -l Season1349943DisturbPowerHarvestingProcess room_name=W27S26 waypoints=W28S26,W28S25,W30S25 patrol_rooms=W30S30,W30S19 attacker_type=attacker")
// Game.io("launch -l Season1349943DisturbPowerHarvestingProcess room_name=W6S29 waypoints=W6S30 patrol_rooms=W0S30,W10S30 attacker_type=attacker")
// Game.io("launch -l Season1349943DisturbPowerHarvestingProcess room_name=W9S24 waypoints=W10S24 patrol_rooms=W10S22,W10S30 attacker_type=large_ranged_attacker")
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
    public readonly attackerType: AttackerType,
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
      attackerType: this.attackerType,
    }
  }

  public static decode(state: Season1349943DisturbPowerHarvestingProcessState): Season1349943DisturbPowerHarvestingProcess {
    return new Season1349943DisturbPowerHarvestingProcess(state.l, state.i, state.p, state.w, state.patrollRoomNames, state.attackerType ?? "ranged_attacker")
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, waypoints: RoomName[], patrollRoomNames: RoomName[], attackerType: AttackerType): Season1349943DisturbPowerHarvestingProcess {
    return new Season1349943DisturbPowerHarvestingProcess(Game.time, processId, parentRoomName, waypoints, patrollRoomNames, attackerType)
  }

  public processShortDescription(): string {
    return `${roomLink(this.parentRoomName)} => ${this.patrollRoomNames.map(roomName => roomLink(roomName)).join(",")}`
  }

  public runOnTick(): void {
    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    if (creeps.length < 1) {
      this.requestCreep()
    }

    creeps.forEach(creep => this.runAttacker(creep))
  }

  private requestCreep(): void {
    const targetRoom = this.waypoints[this.waypoints.length - 1] ?? this.patrollRoomNames[this.patrollRoomNames.length - 1]
    if (targetRoom == null) {
      PrimitiveLogger.programError(`${this.identifier} no room provided ${this.waypoints}, ${this.patrollRoomNames}`)
      return
    }
    const roles = ((): CreepRole[] => {
      switch (this.attackerType) {
      case "attacker":
        return [CreepRole.Attacker, CreepRole.Mover]
      case "ranged_attacker":
      case "large_ranged_attacker":
        return [CreepRole.RangedAttacker, CreepRole.Mover]
      }
    })()
    const body = ((): BodyPartConstant[] => {
      switch (this.attackerType) {
      case "attacker":
        return [ATTACK, MOVE, ATTACK, MOVE]
      case "ranged_attacker":
        return [RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE]
      case "large_ranged_attacker":
        return [
          TOUGH, TOUGH,
          RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
          RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
          MOVE, MOVE, MOVE, MOVE, MOVE,
          HEAL, HEAL, HEAL,
        ]
      }
    })()

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles,
      body,
      initialTask: MoveToRoomTask.create(targetRoom, this.waypoints),
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runAttacker(creep: Creep): void {
    const { moved } = this.avoidHostileAttacker(creep)
    const movement = this.attackHostile(creep, moved !== true)
    switch (this.attackerType) {
    case "attacker":
    case "ranged_attacker":
      break
    case "large_ranged_attacker":
      creep.heal(creep)
      break
    }

    const shouldPauseTask = (moved === true || movement.moved === true || movement.attackedTarget != null)
    if (creep.v5task?.pause != null) {
      creep.v5task.pause(shouldPauseTask)
    }
    if (creep.v5task == null) {
      const patrollRoomNames = [...this.patrollRoomNames]
      if (creep.room.name === patrollRoomNames[patrollRoomNames.length - 1]) {
        const targetRoom = patrollRoomNames.shift()
        if (targetRoom == null || patrollRoomNames.length < 1) {
          PrimitiveLogger.programError(`${this.identifier} not enough patrollRoomNames ${this.patrollRoomNames}`)
          return
        }
        creep.v5task = MoveToRoomTask.create(targetRoom, patrollRoomNames)
      } else {
        const targetRoom = patrollRoomNames.pop()
        if (targetRoom == null || patrollRoomNames.length < 1) {
          PrimitiveLogger.programError(`${this.identifier} not enough patrollRoomNames ${this.patrollRoomNames}`)
          return
        }
        creep.v5task = MoveToRoomTask.create(targetRoom, patrollRoomNames)
      }
    }
  }

  private avoidHostileAttacker(creep: Creep): { moved: boolean } {
    const hostiles = ((): Creep[] => {
      switch (this.attackerType) {
      case "attacker":
        return creep.pos.findInRange(FIND_HOSTILE_CREEPS, 5).filter(creep => (creep.getActiveBodyparts(RANGED_ATTACK) > 0) || (creep.getActiveBodyparts(ATTACK) > 0))
      case "ranged_attacker":
      case "large_ranged_attacker":
        return creep.pos.findInRange(FIND_HOSTILE_CREEPS, 3).filter(creep => (creep.getActiveBodyparts(ATTACK) > 0))
      }
    })()
    const closest = creep.pos.findClosestByRange(hostiles)
    if (closest == null) {
      return {
        moved: false
      }
    }
    const range = ((): number => {
      switch (this.attackerType) {
      case "attacker":
        if (closest.getActiveBodyparts(RANGED_ATTACK) <= 0) {
          return 4
        }
        return 2
      case "ranged_attacker":
      case "large_ranged_attacker":
        return 2
      }
    })()
    if (closest.pos.getRangeTo(creep.pos) > range) {
      return {
        moved: false
      }
    }
    this.fleeFrom(closest.pos, creep, range + 1)
    return {
      moved: true
    }
  }

  private attackHostile(creep: Creep, canMove: boolean): { attackedTarget: Creep | null, moved: boolean } {
    let attackedTarget = null as Creep | null
    let moved = false
    const closestHostile = this.closestHostile(creep)
    if (closestHostile != null) {
      this.attack(creep, closestHostile)
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
    const isMeleeAttacker = ((): boolean => {
      switch (this.attackerType) {
      case "attacker":
        return true
      case "ranged_attacker":
      case "large_ranged_attacker":
        return false
      }
    })()
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS).filter(creep => {
      if (this.whitelistedUsernames.includes(creep.owner.username) === true) {
        return false
      }
      if (creep.ticksToLive == null || creep.ticksToLive < 50) {
        return false
      }
      if (creep.getActiveBodyparts(MOVE) <= 0 && creep.getActiveBodyparts(HEAL) <= 0) {
        return false
      }
      if (isMeleeAttacker === true && (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0)) {
        return false
      }
      return creep.getActiveBodyparts(CARRY) > 0 || creep.getActiveBodyparts(HEAL) > 0
    })
    if (hostiles.length <= 0) {
      return null
    }
    return creep.pos.findClosestByRange(hostiles)
  }

  private attack(creep: Creep, target: AnyCreep | AnyStructure): void {
    switch (this.attackerType) {
    case "attacker":
      creep.attack(target)
      break
    case "ranged_attacker":
    case "large_ranged_attacker":
      if (creep.pos.isNearTo(target.pos) === true) {
        creep.rangedMassAttack()
      } else {
        creep.rangedAttack(target)
      }
      break
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

1105755

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions } from "prototype/creep"
import { SwampRunnerTransferTask } from "v5_object_task/creep_task/meta_task/swamp_runner_transfer_task"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { MessageObserver } from "os/infrastructure/message_observer"
import { processLog } from "process/process_log"
import { GameConstants } from "utility/constants"

const testing = false as boolean

export interface Season1105755HarvestMineralProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  stopSpawning: boolean
  squadSpawned: boolean
}

// Game.io("launch -l Season1105755HarvestMineralProcess room_name=W27S26 target_room_name=W26S24 waypoints=W27S25")
export class Season1105755HarvestMineralProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  private readonly codename: string

  private readonly testBody: BodyPartConstant[] = [
    TOUGH, MOVE,
  ]

  private readonly attackerRoles: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
  private readonly attackerBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    HEAL, HEAL,
  ]

  private readonly harvesterRoles: CreepRole[] = [CreepRole.Harvester, CreepRole.Mover]
  private readonly harvesterBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK, WORK, WORK,
    WORK, WORK, WORK,
    CARRY, CARRY,
  ]

  private readonly haulerRoles: CreepRole[] = [CreepRole.Hauler, CreepRole.Mover]
  private readonly haulerBody: BodyPartConstant[] = [
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY, CARRY,
    CARRY, CARRY, CARRY, CARRY,
    MOVE,
  ]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private stopSpawning: boolean,
    private squadSpawned: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1105755HarvestMineralProcessState {
    return {
      t: "Season1105755HarvestMineralProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      stopSpawning: this.stopSpawning,
      squadSpawned: this.squadSpawned,
    }
  }

  public static decode(state: Season1105755HarvestMineralProcessState): Season1105755HarvestMineralProcess {
    return new Season1105755HarvestMineralProcess(state.l, state.i, state.p, state.tr, state.w, state.stopSpawning, state.squadSpawned ?? true)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season1105755HarvestMineralProcess {
    return new Season1105755HarvestMineralProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, false, false)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public didReceiveMessage(message: string): string {
    const stopSpawning = parseInt(message, 10)
    if (isNaN(stopSpawning) === true) {
      return `Stop spawning flag can be either 1 or 0 (${message})`
    }
    this.stopSpawning = stopSpawning === 1
    return "OK"
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomName]
    const mineral = targetRoom?.find(FIND_MINERALS)[0] ?? null
    if (mineral != null && mineral.mineralAmount <= 0) {
      this.stopSpawning = true
    }

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    const attackers: Creep[] = []
    const harvesters: Creep[] = []
    const haulers: Creep[] = []

    creeps.forEach(creep => {
      if (hasNecessaryRoles(creep, this.attackerRoles) === true) {
        attackers.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, this.harvesterRoles) === true) {
        harvesters.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, this.haulerRoles) === true) {
        haulers.push(creep)
        return
      }
      PrimitiveLogger.programError(`${this.identifier} unknown creep type ${creep.name}`)
    })

    if (creeps.length <= 0) {
      this.squadSpawned = false
    }

    if (this.stopSpawning !== true && this.squadSpawned !== true) {
      if (attackers.length < 1) {
        this.requestCreep(this.attackerRoles, this.attackerBody, CreepSpawnRequestPriority.Low)
      } else {
        if (harvesters.length < 1) {
          this.requestCreep(this.harvesterRoles, this.harvesterBody, CreepSpawnRequestPriority.Low)
        } else {
          if (haulers.length < 1) {
            this.requestCreep(this.haulerRoles, this.haulerBody, CreepSpawnRequestPriority.High)
          } else {
            this.squadSpawned = true
          }
        }
      }
    }

    const squad = this.squadSpawned ? "full squad" : "spawning"
    const stopSpawning = this.stopSpawning ? "not-spawning" : ""
    processLog(this, `${attackers.length} attackers, ${harvesters.length} harvesters, ${haulers.length} haulers, ${roomLink(this.targetRoomName)}, ${squad}, ${stopSpawning}`)

    attackers.forEach(creep => this.runAttacker(creep, mineral))
    harvesters.forEach(creep => this.runHarvester(creep, mineral))
    haulers.forEach(creep => this.runHauler(creep, attackers, harvesters, mineral))
  }

  private requestCreep(roles: CreepRole[], body: BodyPartConstant[], priority: CreepSpawnRequestPriority): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: roles,
      body: testing ? this.testBody : body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runAttacker(creep: Creep, mineral: Mineral | null) {
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null) {
      creep.rangedAttack(closestHostile)
    }
    creep.heal(creep)

    if (creep.v5task != null) {
      return
    }
    if (creep.room.name !== this.targetRoomName || mineral == null) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= 2) {
      this.fleeFrom(closestHostile.pos, creep, 3)
      return
    }

    const sourceKeeper = mineral.pos.findInRange(FIND_HOSTILE_CREEPS, 5)[0]
    if (sourceKeeper != null) {
      if (creep.rangedAttack(sourceKeeper) === ERR_NOT_IN_RANGE) {
        creep.moveTo(sourceKeeper)
      }
      return
    }

    const keeperLair = creep.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR} })
    const target = keeperLair ?? mineral

    if (creep.pos.getRangeTo(target) > 3) {
      creep.moveTo(target.pos, defaultMoveToOptions)
    }
  }

  private runHarvester(creep: Creep, mineral: Mineral | null) {
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= 4) {
      this.fleeFrom(closestHostile.pos, creep, 5)
      return
    }

    if (creep.v5task != null) {
      return
    }
    if (creep.room.name !== this.targetRoomName || mineral == null) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    if (creep.store.getFreeCapacity() <= 0) {
      return
    }

    if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
      creep.moveTo(mineral.pos, defaultMoveToOptions)
    }
  }

  private runHauler(creep: Creep, attackers: Creep[], harvesters: Creep[], mineral: Mineral | null) {
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= 4) {
      this.fleeFrom(closestHostile.pos, creep, 5)
      return
    }

    if (creep.v5task != null) {
      return
    }
    if (creep.room.name !== this.targetRoomName || mineral == null) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    const returnToParentRoom = () => {
      const terminal = Game.rooms[this.parentRoomName]?.terminal
      if (terminal == null) {
        PrimitiveLogger.fatal(`${this.identifier} terminal not found in ${roomLink(this.parentRoomName)}`)
        return
      }
      creep.v5task = SwampRunnerTransferTask.create(TransferResourceApiWrapper.create(terminal, mineral.mineralType))
    }

    if (creep.store.getFreeCapacity() <= 0 || (creep.ticksToLive != null && creep.ticksToLive < (GameConstants.creep.life.lifeTime * 0.35))) {
      creep.say("1")
      returnToParentRoom()
      return
    }

    const harvester = harvesters.find(creep => creep.store.getUsedCapacity(mineral.mineralType) > 0)
    if (harvester != null) {
      if (harvester.transfer(creep, mineral.mineralType) === ERR_NOT_IN_RANGE) {
        if (attackers.length <= 0 && creep.store.getUsedCapacity(mineral.mineralType) > 0) {
          creep.say("2")
          returnToParentRoom()
          return
        }
        creep.moveTo(harvester, defaultMoveToOptions)
      }
    } else {
      if (creep.store.getUsedCapacity(mineral.mineralType) > 0) {
        creep.say("3")
        returnToParentRoom()
        return
      }
    }
  }

  private closestHostile(position: RoomPosition): Creep | null {
    const hostiles = position.findInRange(FIND_HOSTILE_CREEPS, 3)
    if (hostiles.length <= 0) {
      return null
    }
    return hostiles.reduce((lhs, rhs) => {
      return position.getRangeTo(lhs.pos) < position.getRangeTo(rhs.pos) ? lhs : rhs
    })
  }

  private fleeFrom(position: RoomPosition, creep: Creep, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 1,
    })
    creep.moveByPath(path.path)
  }
}

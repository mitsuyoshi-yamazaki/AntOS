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

const testing = false as boolean

export interface Season1105755HarvestMineralProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  stopSpawning: boolean
}

// Game.io("launch -l Season1105755HarvestMineralProcess room_name=W27S26 target_room_name=W26S24 waypoints=W27S25")
export class Season1105755HarvestMineralProcess implements Process, Procedural {
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
    }
  }

  public static decode(state: Season1105755HarvestMineralProcessState): Season1105755HarvestMineralProcess {
    return new Season1105755HarvestMineralProcess(state.l, state.i, state.p, state.tr, state.w, state.stopSpawning)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season1105755HarvestMineralProcess {
    return new Season1105755HarvestMineralProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, false)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomName]
    const mineral = targetRoom?.find(FIND_MINERALS)[0] ?? null

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

    if (attackers.length < 1) {
      this.requestCreep(this.attackerRoles, this.attackerBody, CreepSpawnRequestPriority.Low)
    } else {
      if (harvesters.length < 1) {
        this.requestCreep(this.harvesterRoles, this.harvesterBody, CreepSpawnRequestPriority.Low)
      } else {
        if (haulers.length < 1) {
          this.requestCreep(this.haulerRoles, this.haulerBody, CreepSpawnRequestPriority.High)
        }
      }
    }

    attackers.forEach(creep => this.runAttacker(creep, mineral))
    harvesters.forEach(creep => this.runHarvester(creep, mineral))
    haulers.forEach(creep => this.runHauler(creep, harvesters, mineral))
  }

  private requestCreep(roles: CreepRole[], body: BodyPartConstant[], priority: CreepSpawnRequestPriority): void {
    if (this.stopSpawning === true) {
      return
    }
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

    if (closestHostile != null) {
      creep.rangedAttack(closestHostile)

      if (creep.pos.getRangeTo(closestHostile) <= 2) {
        const path = PathFinder.search(creep.pos, closestHostile.pos, {
          flee: true,
          maxRooms: 1,
        })
        creep.moveByPath(path.path)
        return
      }
    }

    if (creep.pos.getRangeTo(mineral) > 2) {
      creep.moveTo(mineral.pos, defaultMoveToOptions)
    }
  }

  private runHarvester(creep: Creep, mineral: Mineral | null) {
    if (creep.v5task != null) {
      return
    }
    if (creep.room.name !== this.targetRoomName || mineral == null) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= 4) {
      const path = PathFinder.search(creep.pos, closestHostile.pos, {
        flee: true,
        maxRooms: 1,
      })
      creep.moveByPath(path.path)
      return
    }

    if (creep.store.getFreeCapacity() <= 0) {
      return
    }

    if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
      creep.moveTo(mineral.pos, defaultMoveToOptions)
    }
  }

  private runHauler(creep: Creep, harvesters: Creep[], mineral: Mineral | null) {
    if (creep.v5task != null) {
      return
    }
    if (creep.room.name !== this.targetRoomName || mineral == null) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= 4) {
      const path = PathFinder.search(creep.pos, closestHostile.pos, {
        flee: true,
        maxRooms: 1,
      })
      creep.moveByPath(path.path)
      return
    }

    if (creep.store.getFreeCapacity() <= 0) {
      const terminal = Game.rooms[this.parentRoomName]?.terminal
      if (terminal == null) {
        PrimitiveLogger.fatal(`${this.identifier} terminal not found in ${roomLink(this.parentRoomName)}`)
        return
      }
      creep.v5task = SwampRunnerTransferTask.create(TransferResourceApiWrapper.create(terminal, mineral.mineralType))
    }

    const harvester = harvesters.find(creep => creep.store.getUsedCapacity(mineral.mineralType) > 0)
    if (harvester != null) {
      if (harvester.transfer(creep, mineral.mineralType) === ERR_NOT_IN_RANGE) {
        creep.moveTo(harvester, defaultMoveToOptions)
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
}

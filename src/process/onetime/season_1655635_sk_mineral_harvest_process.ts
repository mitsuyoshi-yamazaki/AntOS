1105755

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName, roomTypeOf } from "utility/room_name"
import { coloredResourceType, roomLink } from "utility/log"
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
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { OperatingSystem } from "os/os"
import { Season701205PowerHarvesterSwampRunnerProcess } from "./season_701205_power_harvester_swamp_runner_process"
import { HRAQuad } from "./season_1536602_quad"

export interface Season1655635SKMineralHarvestProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  mineralType: MineralConstant | null
  stopSpawning: boolean
  squadSpawned: boolean
}

// X
// Game.io("launch -l Season1655635SKMineralHarvestProcess room_name=W6S27 target_room_name=W6S26 waypoints=W6S26")
export class Season1655635SKMineralHarvestProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  private readonly codename: string

  private readonly attackerRoles: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
  private readonly attackerBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    HEAL, HEAL, HEAL,
  ]

  private readonly harvesterRoles: CreepRole[] = [CreepRole.Harvester, CreepRole.Mover]
  private readonly harvesterBody: BodyPartConstant[] = [
    WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE, WORK, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
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
    private mineralType: MineralConstant | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season1655635SKMineralHarvestProcessState {
    return {
      t: "Season1655635SKMineralHarvestProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      stopSpawning: this.stopSpawning,
      squadSpawned: this.squadSpawned,
      mineralType: this.mineralType,
    }
  }

  public static decode(state: Season1655635SKMineralHarvestProcessState): Season1655635SKMineralHarvestProcess {
    return new Season1655635SKMineralHarvestProcess(state.l, state.i, state.p, state.tr, state.w, state.stopSpawning, state.squadSpawned ?? true, state.mineralType)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season1655635SKMineralHarvestProcess {
    return new Season1655635SKMineralHarvestProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, false, false, null)
  }

  public processShortDescription(): string {
    const mineral = this.mineralType ? coloredResourceType(this.mineralType) : ""
    return `${roomLink(this.targetRoomName)} ${mineral}`
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
    if (mineral != null) {
      this.mineralType = mineral.mineralType
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
      const harvestingPower = OperatingSystem.os.listAllProcesses().some(processInfo => {
        if (!(processInfo.process instanceof Season701205PowerHarvesterSwampRunnerProcess)) {
          return false
        }
        if (processInfo.process.parentRoomName === this.parentRoomName && processInfo.process.isPickupFinished !== true) {
          return true
        }
        return false
      })

      if (harvestingPower !== true) {
        const needsAttacker = ((): boolean => {
          if (roomTypeOf(this.targetRoomName) !== "source_keeper") {
            return false
          }
          if (attackers.length >= 3) {
            return false
          }
          if (attackers.length < 2) {
            return true
          }
          return attackers.some(creep => {
            if (creep.ticksToLive == null) {
              return false
            }
            return creep.ticksToLive < 100
          })
        })()

        if (needsAttacker === true) {
          const priority: CreepSpawnRequestPriority = attackers.length === 0 ? CreepSpawnRequestPriority.Low : CreepSpawnRequestPriority.High
          this.requestCreep(this.attackerRoles, this.attackerBody, priority)
        } else {
          // if (harvesters.length < 1) {
          //   this.requestCreep(this.harvesterRoles, this.harvesterBody, CreepSpawnRequestPriority.Low)
          // } else {
          //   if (haulers.length < 1) {
          //     this.requestCreep(this.haulerRoles, this.haulerBody, CreepSpawnRequestPriority.High)
          //   } else {
          //     this.squadSpawned = true
          //   }
          // }
        }
      }
    }

    const squad = this.squadSpawned ? "full squad" : "spawning"
    const stopSpawning = this.stopSpawning ? ", not-spawning" : ""
    processLog(this, `${attackers.length} attackers, ${harvesters.length} harvesters, ${haulers.length} haulers, ${roomLink(this.targetRoomName)}, ${squad}${stopSpawning}`)

    this.runAttackers(attackers, mineral)
    harvesters.forEach(creep => this.runHarvester(creep, mineral))
    haulers.forEach(creep => this.runHauler(creep, attackers, harvesters, mineral))
  }

  private requestCreep(roles: CreepRole[], body: BodyPartConstant[], priority: CreepSpawnRequestPriority): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority,
      numberOfCreeps: 1,
      codename: this.codename,
      roles,
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runAttackers(attackers: Creep[], mineral: Mineral | null): void {
    if (attackers.length <= 0) {
      return
    }
    const quad = new HRAQuad(attackers.map(creep => creep.name), {allowPartial: true})

    quad.heal()
    if (quad.allCreeps.length < 2) {
      const waypoints = [...this.waypoints].reverse()
      quad.moveQuadToRoom(this.parentRoomName, waypoints)
      return
    }

    if (mineral == null || quad.inRoom(this.targetRoomName) !== true) {
      quad.moveQuadToRoom(this.targetRoomName, this.waypoints)
      return
    }

    const sourceKeeper = mineral.pos.findInRange(FIND_HOSTILE_CREEPS, 5)[0]
    if (sourceKeeper != null) {
      if (quad.numberOfCreeps < 2) {
        quad.fleeQuadFrom(sourceKeeper.pos, 5)
        return
      }

      const range = quad.getMinRangeTo(sourceKeeper.pos)
      if (range != null && range < 2) {
        quad.fleeQuadFrom(sourceKeeper.pos, 2)
      } else {
        quad.moveQuadTo(sourceKeeper.pos, 3)
      }
      quad.attack(sourceKeeper)
      return
    }

    const keeperLair = mineral.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR } })
    const target = keeperLair ?? mineral
    const targetRange = quad.getMinRangeTo(target.pos)

    if (targetRange == null) {
      quad.say("undef range")
      return
    }
    const safeRange = 4
    if (targetRange > safeRange) {
      quad.moveQuadTo(target.pos, safeRange)
    } else if (targetRange < safeRange) {
      quad.fleeQuadFrom(target.pos, safeRange)
    }
  }

  private runHarvester(creep: Creep, mineral: Mineral | null) {
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= 4) {
      this.fleeFrom(closestHostile.pos, creep, 6)
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
      creep.moveTo(mineral.pos, defaultMoveToOptions())
    }
  }

  private runHauler(creep: Creep, attackers: Creep[], harvesters: Creep[], mineral: Mineral | null) {
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= 4) {
      this.fleeFrom(closestHostile.pos, creep, 6)
      return
    }

    if (creep.v5task != null) {
      return
    }
    if (creep.room.name === this.parentRoomName && (creep.ticksToLive != null && creep.ticksToLive < (GameConstants.creep.life.lifeTime / 3))) {
      creep.v5task = RunApiTask.create(SuicideApiWrapper.create())
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

    if (creep.store.getFreeCapacity() <= 0) {
      processLog(this, `Storage full. Return to room. ${creep.store.getUsedCapacity(mineral.mineralType)}${mineral.mineralType} (${roomLink(this.targetRoomName)})`)
      returnToParentRoom()
      return
    }
    if (creep.ticksToLive != null && creep.ticksToLive < (GameConstants.creep.life.lifeTime * 0.35)) {
      processLog(this, `No lifetime left. Return to room. ${creep.store.getUsedCapacity(mineral.mineralType)}${mineral.mineralType} (${roomLink(this.targetRoomName)})`)
      returnToParentRoom()
      return
    }

    const harvester = harvesters.find(creep => creep.store.getUsedCapacity(mineral.mineralType) > 0)
    if (harvester != null) {
      if (harvester.transfer(creep, mineral.mineralType) === ERR_NOT_IN_RANGE) {
        if (attackers.length <= 0 && creep.store.getUsedCapacity(mineral.mineralType) > 0) {
          processLog(this, `No attackers. Return to room. ${creep.store.getUsedCapacity(mineral.mineralType)}${mineral.mineralType} (${roomLink(this.targetRoomName)})`)
          returnToParentRoom()
          return
        }
        creep.moveTo(harvester, defaultMoveToOptions())
      }
    } else {
      creep.moveTo(mineral, { range: 3 })
      if (harvesters.length <= 0 && creep.store.getUsedCapacity(mineral.mineralType) > 0) {
        processLog(this, `No harvesters. Return to room. ${creep.store.getUsedCapacity(mineral.mineralType)}${mineral.mineralType} (${roomLink(this.targetRoomName)})`)
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

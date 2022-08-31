import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, describeTime, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { defaultMoveToOptions } from "prototype/creep"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { MessageObserver } from "os/infrastructure/message_observer"
import { processLog } from "os/infrastructure/logger"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { ProcessDecoder } from "process/process_decoder"
import { CreepBody } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"
import { avoidSourceKeeper } from "script/move_to_room"
import { Timestamp } from "shared/utility/timestamp"
import type { RoomName } from "shared/utility/room_name_types"
import { roomTypeOf } from "utility/room_coordinate"

ProcessDecoder.register("Season4332399SKMineralHarvestProcess", state => {
  return Season4332399SKMineralHarvestProcess.decode(state as Season4332399SKMineralHarvestProcessState)
})

const fleeRange = 4
const keeperLairSpawnTime = 15
const noMineralReason = "no mineral"
const invaderCoreReason = "invader core"
const waypointInvaderCoreReason = (roomName: RoomName): string => {
  return `waypoint invader core ${roomName}`
}

export interface Season4332399SKMineralHarvestProcessState extends ProcessState {
  roomName: RoomName
  targetRoomName: RoomName
  waypoints: RoomName[]
  waypointSKRooms: RoomName[]

  mineralType: MineralConstant | null
  stopSpawnReason: string[]
  regenerateBy: Timestamp | null
}

/** RCL7以上 */
export class Season4332399SKMineralHarvestProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private readonly attackerRoles: CreepRole[] = [CreepRole.Attacker]
  private readonly attackerBody: BodyPartConstant[] = [
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE, MOVE, MOVE,
    MOVE, MOVE, MOVE,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
    HEAL, HEAL, HEAL,
    HEAL, HEAL, HEAL,
  ]

  private readonly harvesterRoles: CreepRole[] = [CreepRole.Harvester]
  private readonly haulerRoles: CreepRole[] = [CreepRole.Hauler]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly waypoints: RoomName[],
    private readonly waypointSKRooms: RoomName[],
    private stopSpawnReason: string[],
    private mineralType: MineralConstant | null,
    private regenerateBy: Timestamp | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season4332399SKMineralHarvestProcessState {
    return {
      t: "Season4332399SKMineralHarvestProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      waypoints: this.waypoints,
      waypointSKRooms: this.waypointSKRooms,
      stopSpawnReason: this.stopSpawnReason,
      mineralType: this.mineralType,
      regenerateBy: this.regenerateBy,
    }
  }

  public static decode(state: Season4332399SKMineralHarvestProcessState): Season4332399SKMineralHarvestProcess {
    return new Season4332399SKMineralHarvestProcess(state.l, state.i, state.roomName, state.targetRoomName, state.waypoints, state.waypointSKRooms, state.stopSpawnReason, state.mineralType, state.regenerateBy)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season4332399SKMineralHarvestProcess {
    return new Season4332399SKMineralHarvestProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, [], [], null, null)
  }

  public processShortDescription(): string {
    const mineral = this.mineralType ? coloredResourceType(this.mineralType) : ""
    const descriptions: string[] = [
      roomLink(this.targetRoomName),
      mineral,
    ]
    if (this.stopSpawnReason.length > 0) {
      descriptions.push(`spawn stopped: ${this.stopSpawnReason.join(", ")}`)
    }
    if (this.regenerateBy != null && this.regenerateBy > Game.time) {
      const regenerateIn = this.regenerateBy - Game.time
      descriptions.push(`regenerate in ${describeTime(regenerateIn)}`)
    }
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commands = ["stop", "resume"]

    const components = message.split(" ")
    const command = components.shift()

    switch (command) {
    case "stop":
      this.addStopSpawnReason("manually")
      return "spawn stopped"

    case "resume":
      this.stopSpawnReason = []
      return "spawn resumed"

    default:
      return `Invalid command ${command}. Available commands are: ${commands}`
    }
  }

  public harvestingMineralType(): MineralConstant | null {
    return this.mineralType
  }

  public runOnTick(): void {
    const roomResources = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResources == null) {
      return
    }

    const invaderCoreExists = (room: Room): boolean => {
      return room.find(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_INVADER_CORE } }).length > 0
    }
    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom != null) {
      if (invaderCoreExists(targetRoom)) {
        this.addStopSpawnReason(invaderCoreReason)
      } else {
        this.removeStopSpawnReason(invaderCoreReason)
      }
    }
    this.waypointSKRooms.forEach(waypointRoomName => {
      const waypointRoom = Game.rooms[waypointRoomName]
      if (waypointRoom == null) {
        return
      }
      const reason = waypointInvaderCoreReason(waypointRoomName)
      if (invaderCoreExists(waypointRoom)) {
        this.addStopSpawnReason(reason)
      } else {
        this.removeStopSpawnReason(reason)
      }
    })

    const mineral = targetRoom?.find(FIND_MINERALS)[0] ?? null
    if (mineral != null) {
      if (mineral.mineralAmount <= 0) {
        if (mineral.ticksToRegeneration != null) {
          this.regenerateBy = Game.time + mineral.ticksToRegeneration
        }
        this.addStopSpawnReason(noMineralReason)
      } else {
        const index = this.stopSpawnReason.indexOf(noMineralReason)
        if (index >= 0) {
          this.stopSpawnReason.splice(index, 1)
        }
      }
    }
    if (mineral != null) {
      this.mineralType = mineral.mineralType
    }

    const creeps = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)
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

    if (this.stopSpawnReason.length > 0 && this.regenerateBy != null && Game.time > this.regenerateBy) {
      const index = this.stopSpawnReason.indexOf(noMineralReason)
      if (index >= 0) {
        this.stopSpawnReason.splice(index, 1)
      }
    }

    if (this.stopSpawnReason.length <= 0) {
      const needsAttacker = ((): boolean => {
        if (roomTypeOf(this.targetRoomName) !== "source_keeper") {
          return false
        }
        switch (attackers.length) {
        case 0:
          return true
        case 1:
          if (attackers[0]?.ticksToLive == null) {
            return false
          }
          if (attackers[0].ticksToLive < 100) {
            return true
          }
          return false

        default:  // >= 2
          return false
        }
      })()

      if (needsAttacker === true) {
        this.requestCreep(this.attackerRoles, this.attackerBody, CreepSpawnRequestPriority.Low)
      } else {
        if (harvesters[0] == null || (harvesters.length <= 1 && (harvesters[0].ticksToLive != null && harvesters[0].ticksToLive < 100))) {
          const baseBody = [CARRY, CARRY, CARRY, CARRY, CARRY]
          const bodyUnit = [
            WORK, WORK, WORK, WORK, WORK,
            MOVE, MOVE, MOVE, MOVE, MOVE,
          ]
          const body = CreepBody.create(baseBody, bodyUnit, roomResources.room.energyCapacityAvailable, 4)
          this.requestCreep(this.harvesterRoles, body, CreepSpawnRequestPriority.Low)
        } else {
          if (haulers.length < 1) {
            const body = CreepBody.create([], [CARRY, MOVE], roomResources.room.energyCapacityAvailable, 20)
            this.requestCreep(this.haulerRoles, body, CreepSpawnRequestPriority.Medium)
          }
        }
      }
    }

    const sourceKeeper: Creep | null = mineral == null ? null : mineral.pos.findInRange(FIND_HOSTILE_CREEPS, 5)[0] ?? null
    const keeperLair: StructureKeeperLair | null = mineral == null ? null : mineral.pos.findClosestByRange(FIND_HOSTILE_STRUCTURES, { filter: { structureType: STRUCTURE_KEEPER_LAIR } }) as StructureKeeperLair | null

    attackers.forEach(creep => this.runAttacker(creep, mineral, sourceKeeper, keeperLair))
    harvesters.forEach(creep => this.runHarvester(creep, mineral, keeperLair))
    haulers.forEach(creep => this.runHauler(creep, attackers, harvesters, haulers, mineral, keeperLair))
  }

  private requestCreep(roles: CreepRole[], body: BodyPartConstant[], priority: CreepSpawnRequestPriority): void {
    World.resourcePools.addSpawnCreepRequest(this.roomName, {
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

  private runAttacker(creep: Creep, mineral: Mineral | null, sourceKeeper: Creep | null, keeperLair: StructureKeeperLair | null): void {
    if (creep.v5task != null) {
      creep.heal(creep)
      return
    }

    if (mineral == null || creep.room.name !== this.targetRoomName) {
      const waypoints = ((): RoomName[] => {
        if (creep.room.name === this.roomName) {
          return this.waypoints
        }
        return []
      })()
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, waypoints)
      creep.heal(creep)
      return
    }

    if (sourceKeeper != null) {
      creep.heal(creep)
      creep.rangedAttack(sourceKeeper)

      const range = creep.pos.getRangeTo(sourceKeeper.pos)
      if (range < 4) {
        this.fleeFrom(sourceKeeper.pos, creep, 3)
      } else {
        creep.moveTo(sourceKeeper.pos, defaultMoveToOptions())
      }
      return
    }

    if (creep.hits < creep.hitsMax) {
      creep.heal(creep)
    } else {
      const healTarget = creep.pos.findInRange(FIND_MY_CREEPS, 10).find(myCreep => myCreep.hits < myCreep.hitsMax)
      if (healTarget != null) {
        if (creep.heal(healTarget) === ERR_NOT_IN_RANGE) {
          creep.rangedHeal(healTarget)
          creep.moveTo(healTarget, defaultMoveToOptions())
        }
        return
      }
    }

    const target = keeperLair ?? mineral
    const targetRange = creep.pos.getRangeTo(target.pos)

    const safeRange = 4
    if (targetRange > safeRange) {
      creep.moveTo(target, defaultMoveToOptions())
    } else if (targetRange < safeRange) {
      this.fleeFrom(target.pos, creep, safeRange + 1)
    } else {
      // do nothing
    }
  }

  private runHarvester(creep: Creep, mineral: Mineral | null, keeperLair: StructureKeeperLair | null) {
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= fleeRange) {
      this.fleeFrom(closestHostile.pos, creep, fleeRange + 1)
      creep.say("1")
      return
    }
    if (keeperLair != null && keeperLair.ticksToSpawn != null && keeperLair.ticksToSpawn <= keeperLairSpawnTime && creep.pos.getRangeTo(keeperLair) <= fleeRange) {
      this.fleeFrom(keeperLair.pos, creep, fleeRange + 1)
      creep.say("2")
      return
    }

    if (creep.v5task != null) {
      creep.say("3")
      return
    }
    if (creep.room.name !== this.targetRoomName || mineral == null) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      creep.say("33")
      return
    }

    if (creep.store.getFreeCapacity() <= 0) {
      creep.say("34")
      return
    }

    if (creep.harvest(mineral) === ERR_NOT_IN_RANGE) {
      if (creep.pos.getRangeTo(mineral.pos) < 8) {
        creep.say("4")
        creep.moveTo(mineral, defaultMoveToOptions())
      } else {
        creep.say("5")
        avoidSourceKeeper(creep, creep.room, mineral.pos)
      }
    }
  }

  private runHauler(creep: Creep, attackers: Creep[], harvesters: Creep[], haulers: Creep[], mineral: Mineral | null, keeperLair: StructureKeeperLair | null) {
    const closestHostile = this.closestHostile(creep.pos)
    if (closestHostile != null && creep.pos.getRangeTo(closestHostile) <= fleeRange) {
      this.fleeFrom(closestHostile.pos, creep, fleeRange + 1)
      return
    }
    if (keeperLair != null && keeperLair.ticksToSpawn != null && keeperLair.ticksToSpawn <= keeperLairSpawnTime && creep.pos.getRangeTo(keeperLair) <= fleeRange) {
      this.fleeFrom(keeperLair.pos, creep, fleeRange + 1)
      return
    }

    if (creep.v5task != null) {
      return
    }
    if (creep.room.name === this.roomName && (creep.ticksToLive != null && creep.ticksToLive < 250)) {
      creep.v5task = RunApiTask.create(SuicideApiWrapper.create())
      return
    }
    if (creep.room.name !== this.targetRoomName || mineral == null) {
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, this.waypoints)
      return
    }

    const returnToParentRoom = () => {
      const terminal = Game.rooms[this.roomName]?.terminal
      if (terminal == null) {
        PrimitiveLogger.fatal(`${this.identifier} terminal not found in ${roomLink(this.roomName)}`)
        return
      }
      creep.v5task = MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, mineral.mineralType))
    }

    if (creep.store.getFreeCapacity() <= 0) {
      processLog(this, `Creep store full. Return to room. ${creep.store.getUsedCapacity(mineral.mineralType)}${mineral.mineralType} (${roomLink(this.targetRoomName)})`)
      returnToParentRoom()
      return
    }
    if (creep.ticksToLive != null && creep.ticksToLive < 100) {
      processLog(this, `No lifetime left. Return to room. ${creep.store.getUsedCapacity(mineral.mineralType)}${mineral.mineralType} (${roomLink(this.targetRoomName)})`)
      returnToParentRoom()
      return
    }

    const moveHauler = (position: RoomPosition) => {
      if (creep.pos.getRangeTo(mineral.pos) < 8) {
        creep.moveTo(position, defaultMoveToOptions())
      } else {
        avoidSourceKeeper(creep, creep.room, position)
      }
    }

    const harvester = harvesters.find(creep => creep.store.getUsedCapacity(mineral.mineralType) > 0)
    if (harvester != null) {
      const shouldWithdraw = ((): boolean => {
        if (creep.store.getUsedCapacity(mineral.mineralType) > 0) {
          return true
        }
        return haulers.every(hauler => {
          if (hauler === creep) {
            return true
          }
          if (hauler.store.getUsedCapacity(mineral.mineralType) <= 0) {
            return true
          }
          if (hauler.pos.getRangeTo(creep.pos) > 3) {
            return true
          }
          return false
        })
      })()
      if (shouldWithdraw === true) {
        if (harvester.transfer(creep, mineral.mineralType) === ERR_NOT_IN_RANGE) {
          if (attackers.length <= 0 && creep.store.getUsedCapacity(mineral.mineralType) > 0) {
            processLog(this, `No attackers. Return to room. ${creep.store.getUsedCapacity(mineral.mineralType)}${mineral.mineralType} (${roomLink(this.targetRoomName)})`)
            returnToParentRoom()
            return
          }
          moveHauler(harvester.pos)
        }
      } else {
        moveHauler(harvester.pos)
      }
    } else {  // harvester == null
      moveHauler(mineral.pos)
      // avoidSourceKeeper(creep, creep.room, mineral.pos, { moveToOps: {range: 3, reusePath: 3}})
      if (harvesters.length <= 0 && creep.store.getUsedCapacity(mineral.mineralType) > 0) {
        processLog(this, `No harvesters. Return to room. ${creep.store.getUsedCapacity(mineral.mineralType)}${mineral.mineralType} (${roomLink(this.targetRoomName)})`)
        returnToParentRoom()
        return
      }
    }
  }

  private closestHostile(position: RoomPosition): Creep | null {
    return position.findClosestByRange(position.findInRange(FIND_HOSTILE_CREEPS, fleeRange))
  }

  private fleeFrom(position: RoomPosition, creep: Creep, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 1,
    })
    creep.moveByPath(path.path)
  }

  private addStopSpawnReason(reason: string): void {
    if (this.stopSpawnReason.includes(reason) === true) {
      return
    }
    this.stopSpawnReason.push(reason)
  }

  private removeStopSpawnReason(reason: string): void {
    if (this.stopSpawnReason.length <= 0) {
      return
    }
    const index = this.stopSpawnReason.findIndex(storedReason => storedReason === reason)
    if (index < 0) {
      return
    }
    this.stopSpawnReason.splice(index, 1)
  }
}

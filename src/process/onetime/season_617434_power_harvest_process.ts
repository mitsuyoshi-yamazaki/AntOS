import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { RoomName } from "utility/room_name"
import { ProcessState } from "process/process_state"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { SequentialTask, SequentialTaskOptions } from "v5_object_task/creep_task/combined_task/sequential_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { EndlessTask } from "v5_object_task/creep_task/meta_task/endless_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { processLog } from "process/process_log"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { AttackApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_api_wrapper"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"

interface Season617434PowerHarvestProcessCreepSpec {
  maxCount: number
  roles: CreepRole[]
  body: BodyPartConstant[]
}

export interface Season617434PowerHarvestProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** power amount */
  pa: number | null

  /** pickup finished */
  f: boolean
}

/**
 * - [ ] energyCapacityAvailableとPowerBank周囲の空きからAttackerのサイズを算出
 * - [ ] haulerが揃うまでdestroyしない
 */

// Game.io("launch -l Season617434PowerHarvestProcess room_name=W9S24 target_room_name=W10S24")
// Game.io("launch -l Season617434PowerHarvestProcess room_name=W24S29 target_room_name=W25S30")
// Game.io("launch -l Season617434PowerHarvestProcess room_name=W24S29 target_room_name=W26S30 waypoints=W24S30")
// 9589 power (2688 in terminal)
export class Season617434PowerHarvestProcess implements Process, Procedural {
  private readonly identifier: string
  private readonly codename: string

  private readonly scoutSpec: Season617434PowerHarvestProcessCreepSpec = {
    maxCount: 1,
    roles: [CreepRole.Scout],
    body: [MOVE],
  }
  private readonly attackerSpec: Season617434PowerHarvestProcessCreepSpec = {
    maxCount: 3,
    roles: [CreepRole.Attacker, CreepRole.Mover],
    // 570 hits/tick = 2M/3510ticks
    // 2470E = RCL6
    body: [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
      ATTACK, ATTACK, ATTACK, ATTACK,
    ],
  }
  private readonly haulerSpec: Season617434PowerHarvestProcessCreepSpec = {
    maxCount: 3,
    roles: [CreepRole.Hauler, CreepRole.Mover],
    // 1500 capacity
    // 2250E = RCL6
    body: [
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      MOVE, MOVE, MOVE, MOVE, MOVE,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
      CARRY, CARRY, CARRY, CARRY, CARRY,
    ],
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private powerAmount: number | null,
    private pickupFinished: boolean,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season617434PowerHarvestProcessState {
    return {
      t: "Season617434PowerHarvestProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      pa: this.powerAmount,
      f: this.pickupFinished,
    }
  }

  public static decode(state: Season617434PowerHarvestProcessState): Season617434PowerHarvestProcess | null {
    return new Season617434PowerHarvestProcess(state.l, state.i, state.p, state.tr, state.w, state.pa, state.f)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[]): Season617434PowerHarvestProcess {
    return new Season617434PowerHarvestProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, null, false)
  }

  public processShortDescription(): string {
    return roomLink(this.targetRoomName)
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomName]
    let scoutCount = 0
    let attackerCount = 0
    let haulerCount = 0

    scoutCount = this.countCreep(this.scoutSpec.roles)
    attackerCount = this.countCreep(this.attackerSpec.roles)
    haulerCount = this.countCreep(this.haulerSpec.roles)

    let powerBank: StructurePowerBank | null = null
    let powerResource: Resource | Ruin | null = null

    if (targetRoom == null) {
      if (this.pickupFinished !== true && scoutCount <= this.scoutSpec.maxCount) {
        this.addScout()
      }
    } else {
      powerBank = targetRoom.find(FIND_STRUCTURES).find(structure => structure.structureType === STRUCTURE_POWER_BANK) as StructurePowerBank | null

      if (powerBank != null) {
        if (this.powerAmount == null) {
          this.powerAmount = powerBank.power
        }

        if (attackerCount < this.attackerSpec.maxCount) {
          this.addAttacker()
        }
        this.runAttackers(powerBank)
      } else {
        powerResource = targetRoom.find(FIND_DROPPED_RESOURCES).find(resource => resource.resourceType === RESOURCE_POWER)
          ?? targetRoom.find(FIND_RUINS).find(ruin => ruin.structure.structureType === STRUCTURE_POWER_BANK)
          ?? null
        if (powerBank == null && powerResource == null) { // FixMe: 一度ruinになる
          this.pickupFinished = true
        }
      }

      const almost = powerBank != null && powerBank.hits < (powerBank.hitsMax / 2)
      if (powerResource != null || almost) {
        if (haulerCount < this.haulerSpec.maxCount) {
          this.addHauler()
        }
      }
    }

    this.runScout()
    this.runHauler(powerBank, powerResource)

    const workingStatus = this.pickupFinished ? "Pick up finished" : "Working..."
    processLog(this, `${workingStatus} ${roomLink(this.targetRoomName)} ${scoutCount} scouts, ${attackerCount} attackers, ${haulerCount} haulers`)
  }

  // ---- Hauler ---- //
  private addHauler(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: this.haulerSpec.maxCount,
      codename: this.codename,
      roles: this.haulerSpec.roles,
      body: this.haulerSpec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runHauler(powerBank: StructurePowerBank | null, powerResource: Resource | Ruin | null): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.haulerTask(creep, powerBank, powerResource),
      creep => hasNecessaryRoles(creep, this.haulerSpec.roles),
    )
  }

  private haulerTask(creep: Creep, powerBank: StructurePowerBank | null, powerResource: Resource | Ruin | null): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
      if (creep.room.name !== this.parentRoomName) {
        const waypoints = [...this.waypoints].reverse()
        return MoveToRoomTask.create(this.parentRoomName, waypoints)
      }

      const powerSpawn = creep.room.find(FIND_STRUCTURES).find(structure => structure.structureType === STRUCTURE_POWER_SPAWN) as StructurePowerSpawn | null
      if (powerSpawn != null && powerSpawn.store.getFreeCapacity(RESOURCE_POWER) > 0) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(powerSpawn, RESOURCE_POWER))
      }
      if (creep.room.terminal != null) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(creep.room.terminal, RESOURCE_POWER))
      }
      if (creep.room.storage != null) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(creep.room.storage, RESOURCE_POWER))
      }

      creep.say("no storage")
      return null
    }

    if (this.pickupFinished === true) {
      return null
    }

    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, [...this.waypoints])
    }

    if (powerResource != null) {
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(powerResource, RESOURCE_POWER))
    }

    if (powerBank != null) {
      return MoveToTask.create(powerBank.pos, 4)
    }

    creep.say("nothing to do")
    return null
  }

  // ---- Attacker ---- //
  private addAttacker(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: this.attackerSpec.maxCount,
      codename: this.codename,
      roles: this.attackerSpec.roles,
      body: this.attackerSpec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runAttackers(powerBank: StructurePowerBank): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.attackerTask(creep, powerBank),
      creep => hasNecessaryRoles(creep, this.attackerSpec.roles),
    )
  }

  private attackerTask(creep: Creep, powerBank: StructurePowerBank): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    if (powerBank != null) {
      return MoveToTargetTask.create(AttackApiWrapper.create(powerBank))
    }
    return MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 4)
  }

  // ---- Scout ---- //
  private addScout(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: this.scoutSpec.maxCount,
      codename: this.codename,
      roles: this.scoutSpec.roles,
      body: this.scoutSpec.body,
      initialTask: this.scoutTask(),
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runScout(): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      () => this.scoutTask(),
      creep => hasNecessaryRoles(creep, this.scoutSpec.roles),
    )
  }

  private scoutTask(): CreepTask {
    const options: SequentialTaskOptions = {
      ignoreFailure: true,
      finishWhenSucceed: false,
    }
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, this.waypoints),
      MoveToTask.create(new RoomPosition(25, 25, this.targetRoomName), 10),
      EndlessTask.create(),
    ]
    return SequentialTask.create(tasks, options)
  }

  // ---- Functions ---- //
  private countCreep(roles: CreepRole[]): number {
    return World.resourcePools.countCreeps(this.parentRoomName, this.identifier, creep => hasNecessaryRoles(creep, roles))
  }
}

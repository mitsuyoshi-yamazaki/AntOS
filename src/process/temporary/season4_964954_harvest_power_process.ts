import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, profileLink, roomHistoryLink, roomLink } from "utility/log"
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
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { processLog } from "os/infrastructure/logger"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { AttackApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_api_wrapper"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { GameConstants } from "utility/constants"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { decodeRoomPosition, RoomPositionState } from "prototype/room_position"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { bodyCost } from "utility/creep_body"
import { OperatingSystem } from "os/os"
import { RunApisTask } from "v5_object_task/creep_task/combined_task/run_apis_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { getResourceAmountOf } from "prototype/room_object"
import { findRoomRoute } from "utility/map"
import { ParallelTask } from "v5_object_task/creep_task/combined_task/parallel_task"
import { RangedAttackApiWrapper } from "v5_object_task/creep_task/api_wrapper/ranged_attack_api_wrapper"
import { HealApiWrapper } from "v5_object_task/creep_task/api_wrapper/heal_api_wrapper"
import { CreepName, isV5CreepMemory } from "prototype/creep"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"
import { ProcessDecoder } from "process/process_decoder"
import { RangedHealApiWrapper } from "v5_object_task/creep_task/api_wrapper/ranged_heal_api_wrapper"

ProcessDecoder.register("Season4964954HarvestPowerProcess", state => {
  return Season4964954HarvestPowerProcess.decode(state as Season4964954HarvestPowerProcessState)
})

// deals 600 hits/tick = 2M/3333ticks
// 2600E = RCL7
const attackerBody: BodyPartConstant[] = [
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE,
  ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
  ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
  ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
  ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
  MOVE,
]

// heals 300 hits/tick
// 7500E = RCL8
const healerBody: BodyPartConstant[] = [
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL, HEAL,
]

interface Season4964954HarvestPowerProcessCreepSpec {
  maxCount: number
  roles: CreepRole[]
  body: BodyPartConstant[]
}

export interface Season4964954HarvestPowerProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** power bank info */
  pb: {
    /** power amount */
    pa: number

    /** position */
    p: RoomPositionState
  } | null

  /** pickup finished */
  f: boolean

  ticksToPowerBank: number | null
  neighbourCount: number
  powerDropPoints: RoomPositionState[]
  attackerHealerPair: {attackerName: CreepName, healerName: CreepName}[]
}

export class Season4964954HarvestPowerProcess implements Process, Procedural {
  public get isPickupFinished(): boolean {
    return this.pickupFinished
  }

  public get taskIdentifier(): string {
    return this.identifier
  }
  private readonly identifier: string
  private readonly codename: string
  private readonly estimatedTicksToRoom: number
  private readonly fullAttackPower: number
  private readonly whitelistedUsernames: string[]

  private readonly scoutSpec: Season4964954HarvestPowerProcessCreepSpec = {
    maxCount: 1,
    roles: [CreepRole.Scout],
    body: [MOVE],
  }
  private readonly attackerSpec: Season4964954HarvestPowerProcessCreepSpec = {
    maxCount: 3,
    roles: [CreepRole.Attacker, CreepRole.Mover],
    body: attackerBody,
  }
  private readonly healerSpec: Season4964954HarvestPowerProcessCreepSpec = {
    maxCount: 3,
    roles: [CreepRole.Healer, CreepRole.Mover],
    body: healerBody,
  }
  private readonly rangedAttackerSpec: Season4964954HarvestPowerProcessCreepSpec = {
    maxCount: 1,
    roles: [CreepRole.RangedAttacker, CreepRole.Mover],
    body: [
      RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
      MOVE, HEAL, MOVE, HEAL,
    ],
  }
  private get haulerSpec(): Season4964954HarvestPowerProcessCreepSpec {
    const roles = [CreepRole.Hauler, CreepRole.Mover]
    const parentRoom = Game.rooms[this.parentRoomName]

    if (this.powerBankInfo == null || parentRoom == null) {
      return {
        maxCount: 4,
        roles,
        body: [CARRY, CARRY, MOVE, CARRY, CARRY, MOVE],
      }
    }

    // max:
    // 1600 capacity
    // 2500E = RCL6
    const body: BodyPartConstant[] = []
    const bodyUnit = [CARRY, CARRY, MOVE]
    const unitCarryCount = bodyUnit.filter(b => b === CARRY).length
    const unitCarryCapacity = (GameConstants.creep.actionPower.carryCapacity * unitCarryCount)
    const creepMaxCount = 8
    const energyCapacity = parentRoom.energyCapacityAvailable

    const creepMaxBody = 25
    const carryAmountPerCreep = Math.floor(creepMaxBody / bodyUnit.length) * unitCarryCapacity
    const haulableAmount = creepMaxCount * carryAmountPerCreep

    const requiredCarryUnitCount = Math.ceil(this.powerBankInfo.powerAmount / unitCarryCapacity)
    const creepMaxUnitCount = Math.min(Math.floor((energyCapacity - bodyCost(body)) / bodyCost(bodyUnit)), Math.floor(creepMaxBody / bodyUnit.length))
    const requiredCreepCount = Math.min(Math.ceil(requiredCarryUnitCount / creepMaxUnitCount), creepMaxCount)

    const creepUnitCount = ((): number => {
      const estimatedUnitCount = requiredCreepCount * creepMaxUnitCount
      if (estimatedUnitCount > requiredCarryUnitCount) {
        return Math.ceil(requiredCarryUnitCount / requiredCreepCount)
      }
      return creepMaxUnitCount
    })()

    for (let i = 0; i < creepUnitCount; i += 1) {
      body.unshift(...bodyUnit)
    }

    // console.log(`requiredCarryCount: ${requiredCarryCount}, requiredCreepCount: ${requiredCreepCount}, creepCarryCount: ${creepCarryCount}, body: ${body.length}`)

    return {
      maxCount: requiredCreepCount,
      roles,
      body,
    }
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private powerBankInfo: {
      powerAmount: number,
      position: RoomPosition,
    } | null,
    private pickupFinished: boolean,
    private ticksToPowerBank: number | null,
    private readonly neighbourCount: number,
    private readonly powerDropPoints: RoomPosition[],
    private readonly attackerHealerPair: { attackerName: CreepName, healerName: CreepName }[]
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
    this.estimatedTicksToRoom = findRoomRoute(this.parentRoomName, this.targetRoomName, this.waypoints).length * GameConstants.room.size
    this.whitelistedUsernames = Memory.gameInfo.sourceHarvestWhitelist || []

    this.fullAttackPower = this.attackerSpec.body.filter(b => (b === ATTACK)).length * GameConstants.creep.actionPower.attack
  }

  public encode(): Season4964954HarvestPowerProcessState {
    return {
      t: "Season4964954HarvestPowerProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      pb: (() => {
        if (this.powerBankInfo == null) {
          return null
        }
        return {
          pa: this.powerBankInfo.powerAmount,
          p: this.powerBankInfo.position.encode(),
        }
      })(),
      f: this.pickupFinished,
      ticksToPowerBank: this.ticksToPowerBank,
      neighbourCount: this.neighbourCount,
      powerDropPoints: this.powerDropPoints.map(position => position.encode()),
      attackerHealerPair: this.attackerHealerPair,
    }
  }

  public static decode(state: Season4964954HarvestPowerProcessState): Season4964954HarvestPowerProcess | null {
    const powerBankInfo = (() => {
      if (state.pb == null) {
        return null
      }
      const position = decodeRoomPosition(state.pb.p)
      return {
        powerAmount: state.pb.pa,
        position,
      }
    })()
    return new Season4964954HarvestPowerProcess(
      state.l,
      state.i,
      state.p,
      state.tr,
      state.w,
      powerBankInfo,
      state.f,
      state.ticksToPowerBank,
      state.neighbourCount ?? 3,
      state.powerDropPoints?.map(positionState => decodeRoomPosition(positionState)) ?? [],
      state.attackerHealerPair,
    )
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], neighbourCount: number): Season4964954HarvestPowerProcess {
    return new Season4964954HarvestPowerProcess(
      Game.time,
      processId,
      parentRoomName,
      targetRoomName,
      waypoints,
      null,
      false,
      null,
      neighbourCount,
      [],
      [],
    )
  }

  public processShortDescription(): string {
    const finishStatus = this.pickupFinished ? "finished" : "working"
    return `${roomLink(this.targetRoomName)} ${finishStatus}`
  }

  public runOnTick(): void {
    const targetRoom = Game.rooms[this.targetRoomName]
    if (this.ticksToPowerBank == null) {
      const creepInTargetRoom = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, creep => (creep.room.name === this.targetRoomName))[0]
      if (creepInTargetRoom != null && creepInTargetRoom.ticksToLive != null) {
        this.ticksToPowerBank = Math.max(GameConstants.creep.life.lifeTime - creepInTargetRoom.ticksToLive, 0) + 40 // TODO: Creepを引き継いだ場合に異常な値をとる
      }
    }

    const scoutCount = this.countCreep(this.scoutSpec.roles)
    const attackerCount = this.countCreep(this.attackerSpec.roles)
    const healerCount = this.countCreep(this.healerSpec.roles)
    const haulerSpec = this.haulerSpec

    const attackersInTargetRoom = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, creep => {
      if (creep.room.name !== this.targetRoomName) {
        return false
      }
      if (hasNecessaryRoles(creep, this.attackerSpec.roles) !== true) {
        return false
      }
      return true
    })
    const haulers = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, creep => hasNecessaryRoles(creep, haulerSpec.roles) === true)
    const haulerCount = haulers.length
    const rangedAttackerCount = this.countCreep(this.rangedAttackerSpec.roles)

    World.resourcePools.getCreeps(this.parentRoomName, this.identifier, creep => hasNecessaryRoles(creep, haulerSpec.roles)).forEach(hauler => {
      if (hauler.ticksToLive != null && hauler.ticksToLive !== 2) {
        return
      }
      if (hauler.store.getUsedCapacity(RESOURCE_POWER) <= 0) {
        return
      }
      this.powerDropPoints.push(hauler.pos)
    })

    let powerBank: StructurePowerBank | null = null
    const powerResources: (Resource | Ruin | Tombstone)[] = []

    let requestingAttacker = false as boolean
    let estimation = ""

    if (targetRoom == null) {
      if (scoutCount < this.scoutSpec.maxCount) {
        this.addScout()
      }
    } else {
      if (rangedAttackerCount < this.rangedAttackerSpec.maxCount) {
        const hostileExists = targetRoom.find(FIND_HOSTILE_CREEPS).filter(creep => {
          if (this.whitelistedUsernames.includes(creep.owner.username) === true) {
            return false
          }
          if (creep.getActiveBodyparts(MOVE) <= 0 && creep.getActiveBodyparts(HEAL) <= 0) {
            return false
          }
          return (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(CARRY) > 0)
        }).length > 0

        if (hostileExists === true) {
          this.addRangedAttacker()
        }
      }

      if (this.pickupFinished !== true) {
        const whitelistedHarvestCreep = ((): Creep | null => {
          const whitelistedUsernames = Memory.gameInfo.sourceHarvestWhitelist
          if (whitelistedUsernames == null || whitelistedUsernames.length <= 0) {
            return null
          }
          const attackBodyParts: BodyPartConstant[] = [ATTACK, RANGED_ATTACK]
          return targetRoom.find(FIND_HOSTILE_CREEPS).find(creep => {
            if (whitelistedUsernames.includes(creep.owner.username) !== true) {
              return false
            }
            return creep.body.some(b => attackBodyParts.includes(b.type))
          }) ?? null
        })()
        if (whitelistedHarvestCreep != null) {
          const processName = this.constructor.name
          const isHarvesting = targetRoom.find(FIND_MY_CREEPS).some(creep => {
            const isPowerHarvesterCreep = ((): boolean => {
              if (!isV5CreepMemory(creep.memory)) {
                return false
              }
              return creep.memory.i?.includes(processName) === true
            })()
            if (isPowerHarvesterCreep !== true || (creep.body.some(b => (b.type === ATTACK)) !== true)) {
              return false
            }
            return creep.room.name === this.targetRoomName
          })
          if (isHarvesting === true) {
            processLog(this, `${coloredText("[Warning]", "warn")} Whitelisted user ${profileLink(whitelistedHarvestCreep.owner.username)} is trying to harvest ${roomLink(this.targetRoomName)} power`)
          } else {
            processLog(this, `${coloredText("[Warning]", "warn")} Whitelisted user ${profileLink(whitelistedHarvestCreep.owner.username)} is harvesting ${roomLink(this.targetRoomName)} power. quitting...`)
            this.pickupFinished = true

            World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true).forEach(creep => {
              creep.v5task = null
            })
          }
        }
      }

      powerBank = targetRoom.find(FIND_STRUCTURES).find(structure => structure.structureType === STRUCTURE_POWER_BANK) as StructurePowerBank | null

      if (powerBank != null) {
        if (this.powerBankInfo == null) {
          this.powerBankInfo = {
            powerAmount: powerBank.power,
            position: powerBank.pos,
          }
        }

        if (healerCount < attackerCount) {
          this.addHealer()
        } else {
          const targetPowerBank = powerBank
          const needsAttacker = ((): boolean => {
            const attackers = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, creep => hasNecessaryRoles(creep, this.attackerSpec.roles))
            if (attackers.length === 0) {
              return true
            }
            if (attackers.length >= this.attackerSpec.maxCount) {
              return false
            }
            const workingAttackers: Creep[] = []
            const onTheWayAttackers: Creep[] = []
            attackers.forEach(creep => {
              if (creep.pos.isNearTo(targetPowerBank) === true) {
                workingAttackers.push(creep)
              } else {
                onTheWayAttackers.push(creep)
              }
            })

            const damage = workingAttackers.reduce((result, current) => {
              const ticksToLive = current.ticksToLive ?? 0
              return result + (current.getActiveBodyparts(ATTACK) * GameConstants.creep.actionPower.attack * ticksToLive)
            }, 0)
            const estimatedPowerBankHits = targetPowerBank.hits
            if (estimatedPowerBankHits < damage) {
              return false
            }
            const ticksToPowerBank = (this.ticksToPowerBank ?? this.estimatedTicksToRoom) + 40
            const attackDuration = GameConstants.creep.life.lifeTime - ticksToPowerBank
            const ticksToDestroy = ((estimatedPowerBankHits - damage) / this.fullAttackPower)
            const requiredAttackerCount = ((): number => {
              const count = Math.ceil(ticksToDestroy / attackDuration)
              if (count <= 1 && ticksToDestroy > 400) {
                return count + 1
              }
              return count
            })()
            if (requiredAttackerCount <= onTheWayAttackers.length) {
              return false
            }
            const spawnDuration = this.attackerSpec.body.length * GameConstants.creep.life.spawnTime
            const openPositionCount = workingAttackers.filter(creep => {
              if (creep.ticksToLive == null || creep.ticksToLive < (ticksToPowerBank + spawnDuration)) {
                return true
              }
              return false
            }).length + Math.max(this.neighbourCount - workingAttackers.length, 0)
            return openPositionCount > onTheWayAttackers.length
          })()
          if (needsAttacker === true) {
            requestingAttacker = true
            this.addAttacker()
          }
        }
      } else {
        const droppedResources = ((): Resource[] => {
          const resources = targetRoom.find(FIND_DROPPED_RESOURCES, { filter: { resourceType: RESOURCE_POWER } })
          if (this.powerBankInfo == null) {
            return resources
          }
          const powerBankPosition = this.powerBankInfo.position
          return resources.filter(r => (r.pos.isEqualTo(powerBankPosition) === true))
        })()
        powerResources.push(...droppedResources)
        powerResources.push(...targetRoom.find(FIND_RUINS).filter(ruin => ruin.structure.structureType === STRUCTURE_POWER_BANK))
        powerResources.push(...targetRoom.find(FIND_TOMBSTONES).filter(tombstone => (tombstone.store.getUsedCapacity(RESOURCE_POWER) > 0)))

        if (powerBank == null && powerResources.length <= 0) {
          this.pickupFinished = true
        }
      }

      if (requestingAttacker !== true) {
        const almost = ((): boolean => {
          if (powerBank == null) {
            return true
          }
          const attackPowerPerTick = this.fullAttackPower * Math.min(this.neighbourCount, this.attackerSpec.maxCount)
          const ticksToDestroy = Math.ceil(powerBank.hits / attackPowerPerTick)
          const ticksToRoom = this.ticksToPowerBank ?? this.estimatedTicksToRoom
          const haulerCount = this.haulerSpec.maxCount
          const haulerSpawnTime = this.haulerSpec.body.length * GameConstants.creep.life.spawnTime
          const ticksToHaulerReady = (haulerCount * haulerSpawnTime) + ticksToRoom
          estimation = `, ETD: ${Math.ceil(ticksToDestroy / 100) * 100}, hauler ready: ${ticksToHaulerReady} (hits: ${Math.floor(powerBank.hits / 50000) * 50}k)`
          return (ticksToDestroy + 50) < ticksToHaulerReady
        })()
        if (almost === true) {
          if (haulerCount < haulerSpec.maxCount) {
            this.addHauler()
          }
        } else if (powerResources.length > 0) {
          const sum = powerResources.reduce((result, current) => (result + getResourceAmountOf(current, RESOURCE_POWER)), 0)
          const haulerCapacity = haulerSpec.body.filter(body => body === CARRY).length * GameConstants.creep.actionPower.carryCapacity
          const requiredHaulerCount = Math.min(Math.ceil(sum / haulerCapacity), this.haulerSpec.maxCount)
          if (haulerCount < requiredHaulerCount) {
            this.addHauler()
          }
        }
      }
    }

    const ticksToRoom = this.ticksToPowerBank ?? this.estimatedTicksToRoom
    const haulerInTargetRoom = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, creep => {
      if (hasNecessaryRoles(creep, this.haulerSpec.roles) !== true) {
        return false
      }
      if (creep.pos.roomName !== this.targetRoomName) {
        return false
      }
      return true
    })
    const haulerReady = ((): boolean => {
      const dying = haulerInTargetRoom.some(creep => {
        if (creep.ticksToLive == null) {
          return false
        }
        if (creep.ticksToLive < (ticksToRoom * 2 + 150)) {
          return true
        }
        return false
      })
      if (dying === true) {
        return true
      }
      return haulerInTargetRoom.length >= this.haulerSpec.maxCount
    })()

    this.runScout()
    this.runAttackers(powerBank, haulerReady, haulers.filter(creep => creep.store.getUsedCapacity(RESOURCE_POWER) <= 0))
    this.runHealers(powerBank, attackersInTargetRoom)
    this.runHauler(powerBank, powerResources)
    this.runRangedAttacker()

    const workingStatus = this.pickupFinished ? "finished" : "working"
    const haulerCapacity = haulerSpec.body.filter(body => body === CARRY).length * GameConstants.creep.actionPower.carryCapacity
    const haulerDescription = `(${haulerSpec.maxCount} x ${haulerCapacity})`
    processLog(this, `${roomLink(this.parentRoomName)} ${workingStatus} ${roomLink(this.targetRoomName)} ${scoutCount}S, ${attackerCount}A, ${healerCount}HE, ${rangedAttackerCount}RA, ${haulerCount}H ${haulerDescription}${estimation}`)

    if (this.pickupFinished === true) {
      const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
      if (creepCount <= 0) {
        World.resourcePools.assignTasks(
          this.parentRoomName,
          this.identifier,
          CreepPoolAssignPriority.Low,
          () => RunApisTask.create([SuicideApiWrapper.create()], { waitUntilFinishedAll: true, ignoreFailure: true }),
          creep => (creep.body.length <= 1),
        )

        const finishMessage = `${coloredText("[Finished]", "info")} ${roomHistoryLink(this.targetRoomName)}`
        processLog(this, finishMessage)
        // PrimitiveLogger.notice(finishMessage)
        OperatingSystem.os.killProcess(this.processId)
      }
    }
  }

  // ---- Ranged Attacker ---- //
  private addRangedAttacker(): void {
    if (this.pickupFinished === true) {
      return
    }
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: this.rangedAttackerSpec.maxCount,
      codename: this.codename,
      roles: this.rangedAttackerSpec.roles,
      body: this.rangedAttackerSpec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runRangedAttacker(): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.rangedAttackerTask(creep),
      creep => hasNecessaryRoles(creep, this.rangedAttackerSpec.roles),
    )
  }

  private rangedAttackerTask(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    const hostileCreeps = creep.room.find(FIND_HOSTILE_CREEPS).filter(c => {
      if (this.whitelistedUsernames.includes(c.owner.username) === true) {
        return false
      }
      // if (c.getActiveBodyparts(MOVE) <= 0 && c.getActiveBodyparts(HEAL) <= 0) {
      //   return false
      // }
      return c.getActiveBodyparts(ATTACK) > 0 || c.getActiveBodyparts(CARRY) > 0 || c.getActiveBodyparts(RANGED_ATTACK) > 0 || c.getActiveBodyparts(HEAL) > 0
    })
    const target = creep.pos.findClosestByRange(hostileCreeps)
    if (target == null) {
      const damagedCreeps = creep.room.find(FIND_MY_CREEPS).filter(creep => (creep.hits < creep.hitsMax))
      const healTarget = creep.pos.findClosestByRange(damagedCreeps)
      if (healTarget == null) {
        return null
      }
      return MoveToTargetTask.create(HealApiWrapper.create(healTarget))
    }
    const tasks: CreepTask[] = [
      MoveToTargetTask.create(RangedAttackApiWrapper.create(target)),
      RunApiTask.create(HealApiWrapper.create(creep)),
    ]
    return FleeFromAttackerTask.create(ParallelTask.create(tasks), 2)
  }


  // ---- Hauler ---- //
  private addHauler(): void {
    if (this.pickupFinished === true) {
      return
    }
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: this.haulerSpec.maxCount,
      codename: this.codename,
      roles: this.haulerSpec.roles,
      body: this.haulerSpec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runHauler(powerBank: StructurePowerBank | null, powerResources: (Resource | Ruin | Tombstone)[]): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.haulerTask(creep, powerBank, powerResources),
      creep => hasNecessaryRoles(creep, this.haulerSpec.roles),
    )
  }

  private haulerTask(creep: Creep, powerBank: StructurePowerBank | null, powerResources: (Resource | Ruin | Tombstone)[]): CreepTask | null {
    if (powerBank != null) {
      const tasks: CreepTask[] = [
        MoveToRoomTask.create(this.targetRoomName, this.waypoints),
        MoveToTask.create(powerBank.pos, 3),
      ]
      return FleeFromAttackerTask.create(SequentialTask.create(tasks, { ignoreFailure: true, finishWhenSucceed: false }))
    }

    const store = ((): StructureTerminal | StructureStorage | null => {
      if (this.parentRoomName === "W27S26") {
        const childRoomStorage = Game.rooms["W29S25"]?.storage
        if (childRoomStorage != null) {
          return childRoomStorage
        }
      }
      const parentRoom = Game.rooms[this.parentRoomName]
      if (parentRoom == null) {
        return null
      }
      return parentRoom.terminal ?? parentRoom.storage ?? null
    })()
    if (store == null) {
      creep.say("no store")
      PrimitiveLogger.fatal(`${this.constructor.name} parent room ${roomLink(this.parentRoomName)} does not have terminal nor storage`)
      return null
    }

    if (creep.store.getFreeCapacity(RESOURCE_POWER) <= 0 || powerResources.length <= 0) {
      if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
        if (creep.room.name !== store.room.name) {
          const reversedWaypoints = store.room.name === "W29S25" ? [] : [...this.waypoints]
          reversedWaypoints.reverse()
          return FleeFromAttackerTask.create(MoveToRoomTask.create(store.room.name, reversedWaypoints))
        }
        return FleeFromAttackerTask.create(MoveToTargetTask.create(TransferResourceApiWrapper.create(store, RESOURCE_POWER), { ignoreSwamp: false, reusePath: 0 }))
      }
    }

    if (powerResources.length <= 0) {
      const droppedPower = creep.pos.findClosestByRange(creep.room.find(FIND_DROPPED_RESOURCES).filter(r => r.resourceType === RESOURCE_POWER))
      if (droppedPower != null) {
        return FleeFromAttackerTask.create(MoveToTargetTask.create(PickupApiWrapper.create(droppedPower)))
      }
      const tombstone = creep.pos.findClosestByRange(creep.room.find(FIND_TOMBSTONES).filter(t => t.store.getUsedCapacity(RESOURCE_POWER) > 0))
      if (tombstone != null) {
        return FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawResourceApiWrapper.create(tombstone, RESOURCE_POWER)))
      }

      if (this.powerDropPoints.length > 0 && creep.ticksToLive != null) {
        const ticksToLive = creep.ticksToLive
        const point = this.powerDropPoints.find(position => {
          const distanceToPosition = Game.map.getRoomLinearDistance(creep.room.name, position.roomName)
          const distanceToHome = Game.map.getRoomLinearDistance(position.roomName, this.parentRoomName)
          const estimatedDistance = (distanceToPosition * 50 + distanceToHome * 50 * 2) * 1.2
          if (ticksToLive < estimatedDistance) {
            return false
          }
          return true
        })
        if (point != null) {
          const index = this.powerDropPoints.indexOf(point)
          if (index >= 0) {
            this.powerDropPoints.splice(index, 1)
          }
          return FleeFromAttackerTask.create(MoveToRoomTask.create(point.roomName, []))
        }
      }
      if (this.pickupFinished === true) {
        // creep.say("finished")
        if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {  // 念の為
          if (creep.room.name !== store.room.name) {
            const reversedWaypoints = store.room.name === "W29S25" ? [] : [...this.waypoints]
            reversedWaypoints.reverse()
            return FleeFromAttackerTask.create(MoveToRoomTask.create(store.room.name, reversedWaypoints))
          }
          return FleeFromAttackerTask.create(MoveToTargetTask.create(TransferResourceApiWrapper.create(store, RESOURCE_POWER)))
        }
        switch (creep.room.name) {
        case this.parentRoomName: {
          const reversedWaypoints = store.room.name === "W29S25" ? [] : [...this.waypoints]
          return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, reversedWaypoints))
        }
        case this.targetRoomName: {
          const waitingPosition = new RoomPosition(40, 40, creep.room.name)
          if (creep.pos.getRangeTo(waitingPosition) > 4) {
            return MoveToTask.create(waitingPosition, 4)
          }
          return null
        }
        default:
          return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, []))
        }
      } else {
        creep.say("error")
        PrimitiveLogger.fatal(`${this.constructor.name} no visual to ${roomLink(this.targetRoomName)}`)
        this.pickupFinished = true
        return null
      }
    }

    const targetResource = powerResources.reduce((lhs, rhs) => {
      const lTargetedBy = lhs.v5TargetedBy.length
      const rTargetedBy = rhs.v5TargetedBy.length
      if (lTargetedBy === rTargetedBy) {
        return getResourceAmountOf(lhs, RESOURCE_POWER) > getResourceAmountOf(rhs, RESOURCE_POWER) ? lhs : rhs
      }
      return lTargetedBy < rTargetedBy ? lhs : rhs
    })

    if (creep.room.name === this.parentRoomName) {
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, this.waypoints))
    }
    return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(targetResource, RESOURCE_POWER))
  }

  // ---- Healer ---- //
  private addHealer(): void {
    if (this.pickupFinished === true) {
      return
    }

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: this.healerSpec.maxCount,
      codename: this.codename,
      roles: this.healerSpec.roles,
      body: this.healerSpec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runHealers(powerBank: StructurePowerBank | null, attackersInRoom: Creep[]): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.healerTask(creep, powerBank, attackersInRoom),
      creep => hasNecessaryRoles(creep, this.healerSpec.roles),
    )
  }

  private healerTask(creep: Creep, powerBank: StructurePowerBank | null, attackersInRoom: Creep[]): CreepTask | null {
    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    const getNearbyDamagedCreeps = (): Creep[] => {
      return creep.room.find(FIND_MY_CREEPS).filter(myCreep => myCreep.hits < myCreep.hitsMax)
    }

    const healCreepTask = (healTarget: Creep): CreepTask => {
      const range = creep.pos.getRangeTo(healTarget.pos)
      if (range <= GameConstants.creep.actionRange.heal) {
        return MoveToTargetTask.create(HealApiWrapper.create(healTarget))
      }
      // if (range <= GameConstants.creep.actionRange.rangedHeal) {
      //   return MoveToTargetTask.create(RangedHealApiWrapper.create(healTarget))
      // }
      return MoveToTask.create(healTarget.pos, 1)
    }

    const healDamagedCreepTask = (): CreepTask | null => {
      const damagedCreep = creep.pos.findClosestByRange(getNearbyDamagedCreeps())
      if (damagedCreep == null) {
        return null
      }
      return healCreepTask(damagedCreep)
    }

    if (powerBank == null) {
      return healDamagedCreepTask()
    }

    if (creep.pos.getRangeTo(powerBank.pos) > 2) {
      return MoveToTask.create(powerBank.pos, 2)
    }

    const healerPair = this.attackerHealerPair.map((pair, index) => ({ pair, index})).find(pair => pair.pair.healerName === creep.name)
    if (healerPair == null) {
      const pairedAttackers = this.attackerHealerPair.map(pair => pair.attackerName)
      const healerLessAttacker = attackersInRoom.find(attacker => {
        if (pairedAttackers.includes(attacker.name) === true) {
          return false
        }
        return true
      })

      if (healerLessAttacker == null) {
        return healDamagedCreepTask()
      }

      this.attackerHealerPair.push({
        attackerName: healerLessAttacker.name,
        healerName: creep.name,
      })

      return healCreepTask(healerLessAttacker)
    }

    const pairedAttacker = Game.creeps[healerPair.pair.attackerName]
    if (pairedAttacker == null) {
      this.attackerHealerPair.splice(healerPair.index, 1)
      return null
    }
    return healCreepTask(pairedAttacker)
  }

  // ---- Attacker ---- //
  private addAttacker(): void {
    if (this.pickupFinished === true) {
      return
    }

    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: this.attackerSpec.maxCount,
      codename: this.codename,
      roles: this.attackerSpec.roles,
      body: this.attackerSpec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runAttackers(powerBank: StructurePowerBank | null, haulerReady: boolean, emptyHaulers: Creep[]): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.attackerTask(creep, powerBank, haulerReady, emptyHaulers),
      creep => hasNecessaryRoles(creep, this.attackerSpec.roles),
    )
  }

  private attackerTask(creep: Creep, powerBank: StructurePowerBank | null, haulerReady: boolean, emptyHaulers: Creep[]): CreepTask | null {
    if (this.pickupFinished === true) {
      return this.attackNearbyHostileHaulerTask(creep)
    }
    const hostileCreep = creep.pos.findInRange(FIND_HOSTILE_CREEPS, GameConstants.creep.actionRange.attack)
      .filter(hostileCreep => {
        return this.whitelistedUsernames.includes(hostileCreep.owner.username) !== true
      })[0]
    if (hostileCreep != null && hostileCreep.getActiveBodyparts(ATTACK) <= 0) {
      return RunApiTask.create(AttackApiWrapper.create(hostileCreep))
    }

    if (creep.room.name !== this.targetRoomName) {
      return MoveToRoomTask.create(this.targetRoomName, this.waypoints)
    }

    if (powerBank != null) {
      const shouldAttack = ((): boolean => {
        if (creep.hits < 2500) {
          return false
        }
        if (haulerReady === true) {
          return true
        }
        if (powerBank.hits > 2000) {
          return true
        }
        if (powerBank.ticksToDecay < 20) {
          return true
        }
        if (creep.ticksToLive == null) {
          return true
        }
        if (creep.ticksToLive < 10) {
          return true
        }
        if (creep.hits < creep.hitsMax) {
          return true
        }
        if (creep.pos.findInRange(FIND_HOSTILE_CREEPS, 12).length > 0) {
          return true
        }
        return false
      })()
      if (shouldAttack === true) {
        return MoveToTargetTask.create(AttackApiWrapper.create(powerBank))
      } else {
        // creep.say("waiting")
        return null
      }
    }

    const attackNearbyHostileHaulerTask = this.attackNearbyHostileHaulerTask(creep)
    if (attackNearbyHostileHaulerTask != null) {
      return attackNearbyHostileHaulerTask
    }

    if (this.powerBankInfo == null) {
      return null
    }
    const emptyHauler = creep.pos.findInRange(emptyHaulers, 1)[0]
    if (emptyHauler == null) {
      return MoveToTask.create(this.powerBankInfo.position, 1)
    }
    if (creep.pos.isNearTo(this.powerBankInfo.position) === true) {
      return MoveToTask.create(emptyHauler.pos, 0)
    } else {
      return MoveToTask.create(this.powerBankInfo.position, 1)
    }
  }

  private attackNearbyHostileHaulerTask(creep: Creep): CreepTask | null {
    const hostileHauler = creep.pos.findClosestByRange(creep.room.find(FIND_HOSTILE_CREEPS).filter(hostileCreep => {
      if (this.whitelistedUsernames.includes(hostileCreep.owner.username) === true) {
        return false
      }
      return (hostileCreep.getActiveBodyparts(CARRY) > 0)
    }))
    if (hostileHauler == null) {
      return null
    }
    return MoveToTargetTask.create(AttackApiWrapper.create(hostileHauler))
  }

  // ---- Scout ---- //
  private addScout(): void {
    if (this.pickupFinished === true) {
      return
    }
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.High,
      numberOfCreeps: this.scoutSpec.maxCount,
      codename: this.codename,
      roles: this.scoutSpec.roles,
      body: this.scoutSpec.body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runScout(): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.scoutTask(creep),
      creep => hasNecessaryRoles(creep, this.scoutSpec.roles),
    )
  }

  private scoutTask(creep: Creep): CreepTask | null {
    const options: SequentialTaskOptions = {
      ignoreFailure: true,
      finishWhenSucceed: false,
    }

    const waitingPosition = new RoomPosition(25, 25, this.targetRoomName)
    const range = 10
    if (creep.pos.inRangeTo(waitingPosition, range) === true) {
      return null
    }

    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.targetRoomName, this.waypoints),
      MoveToTask.create(waitingPosition, range),
    ]
    return FleeFromAttackerTask.create(SequentialTask.create(tasks, options))
  }

  // ---- Functions ---- //
  private countCreep(roles: CreepRole[]): number {
    return World.resourcePools.countCreeps(this.parentRoomName, this.identifier, creep => hasNecessaryRoles(creep, roles))
  }
}

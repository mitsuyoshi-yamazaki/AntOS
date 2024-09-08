import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredText, profileLink, roomHistoryLink, roomLink } from "utility/log"
import { World } from "world_info/world_info"
import type { RoomName } from "shared/utility/room_name_types"
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
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { GameConstants } from "utility/constants"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { decodeRoomPosition, Position, RoomPositionState } from "prototype/room_position"
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
import { CreepName, defaultMoveToOptions, isV5CreepMemory } from "prototype/creep"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"
import { ProcessDecoder } from "process/process_decoder"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { GameMap } from "game/game_map"
import { Quad, QuadState } from "../../../submodules/private/attack/quad/quad"
import { RoomResources } from "room_resource/room_resources"
import { OwnedRoomProcess } from "process/owned_room_process"

ProcessDecoder.register("HarvestPowerProcess", state => {
  return HarvestPowerProcess.decode(state as HarvestPowerProcessState)
})

type PowerBankInfo = {
  readonly id: Id<StructurePowerBank>
  readonly powerAmount: number
  readonly position: Position
  readonly neighbourCount: number
}

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
  MOVE, MOVE, MOVE, MOVE,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  MOVE,
]

// ---- Boosted ---- //
// const boostedCreepBoosts: MineralBoostConstant[] = [
//   RESOURCE_UTRIUM_HYDRIDE,
//   RESOURCE_LEMERGIUM_OXIDE,
//   RESOURCE_GHODIUM_OXIDE,
//   RESOURCE_ZYNTHIUM_OXIDE,
// ]
// const boostedAttackerBody: BodyPartConstant[] = [
//   TOUGH,TOUGH,TOUGH,TOUGH,TOUGH,
//   TOUGH,
//   MOVE, MOVE, MOVE, MOVE, MOVE,
//   MOVE, MOVE, MOVE, MOVE, MOVE,
//   MOVE, MOVE, MOVE, MOVE, MOVE,
//   MOVE,
//   ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
//   ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
//   ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
//   ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
//   ATTACK, ATTACK, ATTACK, ATTACK, ATTACK,
//   ATTACK, ATTACK,
//   MOVE,
// ]

// const boostedHealerBody: BodyPartConstant[] = [
//   MOVE, MOVE, MOVE, MOVE, MOVE,
//   MOVE, MOVE, MOVE, MOVE, MOVE,
//   MOVE,
//   HEAL, HEAL, HEAL, HEAL, HEAL,
//   HEAL, HEAL, HEAL, HEAL, HEAL,
//   HEAL, HEAL, HEAL, HEAL, HEAL,
//   HEAL, HEAL, HEAL, HEAL, HEAL,
//   HEAL, HEAL, HEAL, HEAL,
//   MOVE,
// ]

// export function canLaunchBoostedPowerBankHarvester(parentRoomName: RoomName): boolean {
//   const roomResource = RoomResources.getOwnedRoomResource(parentRoomName)
//   if (roomResource == null) {
//     return false
//   }
//   const boostLabs = roomResource.roomInfoAccessor.config.getBoostLabs()
//   if (boostLabs.length !== boostedCreepBoosts.length) {
//     return false
//   }
//   const requiredBoosts = new Map<MineralBoostConstant, number>()
//   const addBoostCost = (boosts: Map<MineralBoostConstant, number>): void => {
//     boosts.forEach((cost, boost) => requiredBoosts.set(boost, (requiredBoosts.get(boost) ?? 0) + cost))
//   }
//   addBoostCost(CreepBody.boostCost(boostedAttackerBody, boostedCreepBoosts))
//   addBoostCost(CreepBody.boostCost(boostedHealerBody, boostedCreepBoosts))

//   boostedCreepBoosts.forEach((boost): void => {
//     const cost = requiredBoosts.get(boost)
//     if (cost == null) {
//       return
//     }
//     const boostCost = cost

//     const hasLab = boostLabs.some(lab => {
//       if (lab.mineralType !== boost) {
//         return false
//       }
//       if (lab.store.getUsedCapacity(boost) < boostCost) {
//         return false
//       }
//       return true
//     })
//     if (hasLab !== true) {
//       return
//     }
//     requiredBoosts.delete(boost)
//   })

//   if (requiredBoosts.size > 0) {
//     return false
//   }
//   return true
// }

interface HarvestPowerProcessCreepSpec {
  maxCount: number
  roles: CreepRole[]
  body: BodyPartConstant[]
}

export interface HarvestPowerProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  /** power bank info */
  pb: PowerBankInfo

  /** pickup finished */
  f: boolean

  ticksToPowerBank: number | null
  powerDropPoints: RoomPositionState[]
  attackerHealerPair: {attackerName: CreepName, healerName: CreepName}[]
  storageRoomName: RoomName | null
  shouldLaunchBoostedCreep: boolean
  quadState: QuadState | null
}

export class HarvestPowerProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public get isPickupFinished(): boolean {
    return this.pickupFinished
  }
  public get ownedRoomName(): RoomName {
    return this.parentRoomName
  }

  public get taskIdentifier(): string {
    return this.identifier
  }
  private readonly identifier: string
  private readonly codename: string
  private readonly estimatedTicksToRoom: number
  private readonly fullAttackPower: number
  private readonly whitelistedUsernames: string[]

  private readonly scoutSpec: HarvestPowerProcessCreepSpec = {
    maxCount: 1,
    roles: [CreepRole.Scout],
    body: [MOVE],
  }
  private readonly attackerSpec: HarvestPowerProcessCreepSpec = {
    maxCount: 3,
    roles: [CreepRole.Attacker, CreepRole.Mover],
    body: attackerBody,
  }
  private readonly healerSpec: HarvestPowerProcessCreepSpec = {
    maxCount: 3,
    roles: [CreepRole.Healer, CreepRole.Mover],
    body: healerBody,
  }
  private readonly rangedAttackerSpec: HarvestPowerProcessCreepSpec = {
    maxCount: 1,
    roles: [CreepRole.RangedAttacker, CreepRole.Mover],
    body: [
      RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE, RANGED_ATTACK, MOVE,
      MOVE, HEAL, MOVE, HEAL,
    ],
  }
  private get haulerSpec(): HarvestPowerProcessCreepSpec {
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
    // const carryAmountPerCreep = Math.floor(creepMaxBody / bodyUnit.length) * unitCarryCapacity
    // const haulableAmount = creepMaxCount * carryAmountPerCreep

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

  private lackOfEnergy = false

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    public readonly powerBankInfo: PowerBankInfo,
    private pickupFinished: boolean,
    private ticksToPowerBank: number | null,
    private readonly powerDropPoints: RoomPosition[],
    private readonly attackerHealerPair: { attackerName: CreepName, healerName: CreepName }[],
    private storageRoomName: RoomName | null,
    private shouldLaunchBoostedCreep: boolean,
    private quadState: QuadState | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
    this.estimatedTicksToRoom = findRoomRoute(this.parentRoomName, this.targetRoomName, this.waypoints).length * GameConstants.room.size
    this.whitelistedUsernames = [
      ...Game.whitelist,
      ...(Memory.gameInfo.sourceHarvestWhitelist ?? []),
    ]

    this.fullAttackPower = this.attackerSpec.body.filter(b => (b === ATTACK)).length * GameConstants.creep.actionPower.attack
  }

  public encode(): HarvestPowerProcessState {
    return {
      t: "HarvestPowerProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      pb: this.powerBankInfo,
      f: this.pickupFinished,
      ticksToPowerBank: this.ticksToPowerBank,
      powerDropPoints: this.powerDropPoints.map(position => position.encode()),
      attackerHealerPair: this.attackerHealerPair,
      storageRoomName: this.storageRoomName,
      shouldLaunchBoostedCreep: this.shouldLaunchBoostedCreep,
      quadState: this.quadState,
    }
  }

  public static decode(state: HarvestPowerProcessState): HarvestPowerProcess | null {
    return new HarvestPowerProcess(
      state.l,
      state.i,
      state.p,
      state.tr,
      state.w,
      state.pb,
      state.f,
      state.ticksToPowerBank,
      state.powerDropPoints?.map(positionState => decodeRoomPosition(positionState)) ?? [],
      state.attackerHealerPair,
      state.storageRoomName,
      state.shouldLaunchBoostedCreep,
      state.quadState,
    )
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], powerBankInfo: PowerBankInfo): HarvestPowerProcess {
    const shouldLaunchBoostedCreep = false
    return new HarvestPowerProcess(
      Game.time,
      processId,
      parentRoomName,
      targetRoomName,
      waypoints,
      powerBankInfo,
      false,
      null,
      [],
      [],
      null,
      shouldLaunchBoostedCreep,
      null,
    )
  }

  public processShortDescription(): string {
    const finishStatus = this.pickupFinished ? "finished" : "working"
    return `${roomLink(this.targetRoomName)} ${finishStatus}`
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "set_storage_room"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "set_storage_room": {
        const listArguments = new ListArguments(components)
        const storageRoomName = listArguments.roomName(0, "storage room name").parse({ my: true })
        this.setStorageRoomName(storageRoomName)
        return `storage room ${roomLink(storageRoomName)} set`
      }

      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public setStorageRoomName(storageRoomName: RoomName): void {
    this.storageRoomName = storageRoomName
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResource != null) {
      this.lackOfEnergy = roomResource.getResourceAmount(RESOURCE_ENERGY) < 30000

      if (this.lackOfEnergy === true && (Game.time % 103) === 17) {
        PrimitiveLogger.fatal(`${this.identifier} lack of energy (${roomResource.getResourceAmount(RESOURCE_ENERGY)}) in ${roomLink(this.parentRoomName)}`)
      }
    } else {
      this.lackOfEnergy = true
    }

    const targetRoom = Game.rooms[this.targetRoomName]
    if (this.ticksToPowerBank == null) {
      const creepInTargetRoom = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, creep => (creep.room.name === this.targetRoomName))[0]
      if (creepInTargetRoom != null && creepInTargetRoom.ticksToLive != null) {
        this.ticksToPowerBank = Math.max(GameConstants.creep.life.lifeTime - creepInTargetRoom.ticksToLive, 0) + 40 // TODO: Creepを引き継いだ場合に異常な値をとる
      }
    }

    const allCreeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier)
    const haulerSpec = this.haulerSpec

    const scouts: Creep[] = []
    const attackers: Creep[] = []
    const healers: Creep[] = []
    const haulers: Creep[] = []
    const rangedAttackers: Creep[] = []

    allCreeps.forEach(creep => {
      if (hasNecessaryRoles(creep, this.attackerSpec.roles) === true) {
        attackers.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, this.healerSpec.roles) === true) {
        healers.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, haulerSpec.roles) === true) {
        haulers.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, this.rangedAttackerSpec.roles) === true) {
        rangedAttackers.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, this.scoutSpec.roles) === true) {
        scouts.push(creep)
        return
      }
    })
    const scoutCount = scouts.length
    const attackerCount = attackers.length
    const healerCount = healers.length
    const haulerCount = haulers.length
    const rangedAttackerCount = rangedAttackers.length

    const attackersInTargetRoom = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, creep => {
      if (creep.room.name !== this.targetRoomName) {
        return false
      }
      if (hasNecessaryRoles(creep, this.attackerSpec.roles) !== true) {
        return false
      }
      return true
    })

    haulers.forEach(hauler => {
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
      // if (rangedAttackerCount < this.rangedAttackerSpec.maxCount) {
      //   const hostileExists = targetRoom.find(FIND_HOSTILE_CREEPS).filter(creep => {
      //     if (this.whitelistedUsernames.includes(creep.owner.username) === true) {
      //       return false
      //     }
      //     if (creep.getActiveBodyparts(MOVE) <= 0 && creep.getActiveBodyparts(HEAL) <= 0) {
      //       return false
      //     }
      //     return (creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(CARRY) > 0)
      //   }).length > 0

      //   if (hostileExists === true) {
      //     this.addRangedAttacker()
      //   }
      // }

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

            World.resourcePools.getCreeps(this.parentRoomName, this.identifier).forEach(creep => {
              creep.v5task = null
            })
          }
        }
      }

      powerBank = Game.getObjectById(this.powerBankInfo.id)

      if (powerBank != null) {
        if (healerCount < attackerCount) {
          this.addHealer()
        } else {
          const targetPowerBank = powerBank
          const needsAttacker = ((): boolean => {
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
            }).length + Math.max(this.powerBankInfo.neighbourCount - workingAttackers.length, 0)
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
          const powerBankPosition = decodeRoomPosition(this.powerBankInfo.position, this.targetRoomName)
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
          const attackPowerPerTick = this.fullAttackPower * Math.min(this.powerBankInfo.neighbourCount, this.attackerSpec.maxCount)
          const ticksToDestroy = Math.ceil(powerBank.hits / attackPowerPerTick)
          const ticksToRoom = this.ticksToPowerBank ?? this.estimatedTicksToRoom
          const haulerCount = this.haulerSpec.maxCount
          const haulerSpawnTime = this.haulerSpec.body.length * GameConstants.creep.life.spawnTime
          const ticksToHaulerReady = (haulerCount * haulerSpawnTime) + ticksToRoom
          estimation = `, ETD: ${Math.ceil(ticksToDestroy / 100) * 100}, hauler ready: ${ticksToHaulerReady} (hits: ${Math.floor(powerBank.hits / 100000) * 100}k)`
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
    const haulerInTargetRoom = haulers.filter(creep => {
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

    if (powerBank != null && (this.attackerHealerPair.length > 0 || this.quadState != null)) {
      const hostileAttackerCreeps = powerBank.pos.findInRange(FIND_HOSTILE_CREEPS, 16).filter(hostileCreep => {
        if (this.whitelistedUsernames.includes(hostileCreep.owner.username) === true) {
          return false
        }
        return hostileCreep.getActiveBodyparts(ATTACK) > 0 || hostileCreep.getActiveBodyparts(HEAL) > 0 || hostileCreep.getActiveBodyparts(RANGED_ATTACK) > 0
      })
      if (hostileAttackerCreeps.length > 0) {
        const quad = ((): Quad | null => {
          if (this.quadState != null) {
            const decoded = Quad.decode(this.quadState, null)
            if (decoded != null) {
              return decoded
            }
          }
          return this.assembleQuad()
        })()
        if (quad != null) {
          this.runQuad(quad, hostileAttackerCreeps)

          quad.creepNames.forEach(creepName => {
            const attackerIndex = attackers.findIndex(creep => creep.name === creepName)
            if (attackerIndex >= 0) {
              attackers.splice(attackerIndex, 1)
            }
            const healerIndex = healers.findIndex(creep => creep.name === creepName)
            if (healerIndex >= 0) {
              healers.splice(healerIndex, 1)
            }
          })

          this.quadState = quad.encode()
        }
      } else {
        if (this.quadState != null) {
          this.disassembleQuad()
        }
      }
    }

    this.runAttackers(attackers, powerBank, haulerReady)
    this.runHealers(healers, powerBank, attackersInTargetRoom)
    this.runHauler(powerBank, powerResources)
    this.runRangedAttacker()

    const workingStatus = this.pickupFinished ? "finished" : "working"
    const haulerCapacity = haulerSpec.body.filter(body => body === CARRY).length * GameConstants.creep.actionPower.carryCapacity
    const haulerDescription = `(${haulerSpec.maxCount} x ${haulerCapacity})`
    processLog(this, `${roomLink(this.parentRoomName)} ${workingStatus} ${roomLink(this.targetRoomName)} ${scoutCount}S, ${attackerCount}A, ${healerCount}HE, ${rangedAttackerCount}RA, ${haulerCount}H ${haulerDescription}${estimation}`)

    if (this.pickupFinished === true) {
      const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier)
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

  private runQuad(quad: Quad, hostileCreeps: Creep[]): void {
    try {
      const closestHostile = ((): Creep | null => {
        return quad.pos.findClosestByPath(hostileCreeps)
      })()

      quad.beforeRun()
      quad.heal()

      if (quad.pos.roomName === this.targetRoomName) {
        if (closestHostile == null) {
          return
        }
        const optionalTargets = hostileCreeps.filter(creep => {
          if (creep.name === closestHostile.name) {
            return false
          }
          return true
        })

        quad.moveTo(closestHostile.pos, 1)
        quad.attack(closestHostile, optionalTargets, false)
      } else {
        quad.moveToRoom(this.targetRoomName, [])
        quad.passiveAttack(hostileCreeps, false)
      }
      quad.run()
    } catch {
      //
    }
  }

  private assembleQuad(): Quad | null {
    const attackerHealerPairs = this.attackerHealerPair.flatMap((namePair): {attacker: Creep, healer: Creep}[] => {
      const attacker = Game.creeps[namePair.attackerName]
      const healer = Game.creeps[namePair.healerName]
      if (attacker == null || healer == null) {
        return []
      }
      return [{
        attacker,
        healer,
      }]
    })

    const firstPair = attackerHealerPairs.shift()
    if (firstPair == null) {
      return null
    }

    const leaderCreep = firstPair.attacker
    const follwerCreeps: Creep[] = [firstPair.healer]
    attackerHealerPairs.forEach(pair => {
      if (follwerCreeps.length < 3) {
        follwerCreeps.push(pair.attacker)
      }
      if (follwerCreeps.length < 3) {
        follwerCreeps.push(pair.healer)
      }
    })

    const quad = Quad.create(leaderCreep, follwerCreeps)
    if (quad == null) {
      return null
    }
    const quadCreeps: Creep[] = [
      leaderCreep,
      ...follwerCreeps,
    ]
    quadCreeps.forEach(creep => {
      creep.v5task = null
    })
    return quad
  }

  private disassembleQuad(): void {
    this.quadState = null
  }

  // ---- Ranged Attacker ---- //
  private addRangedAttacker(): void {
    if (this.pickupFinished === true || this.lackOfEnergy === true) {
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
      return this.createMoveToRoomTask(creep)
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
    if (this.pickupFinished === true || this.lackOfEnergy === true) {
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
        this.createMoveToRoomTask(creep),
        MoveToTask.create(powerBank.pos, 3),
      ]
      return FleeFromAttackerTask.create(SequentialTask.create(tasks, { ignoreFailure: true, finishWhenSucceed: false }))
    }

    const store = ((): StructureTerminal | StructureStorage | null => {
      if (this.storageRoomName != null) {
        const storageRoom = Game.rooms[this.storageRoomName]
        if (storageRoom != null) {
          const storageRoomStore = storageRoom.terminal ?? storageRoom.storage
          if (storageRoomStore != null) {
            return storageRoomStore
          }
        }
      }
      const parentRoom = Game.rooms[this.parentRoomName]
      if (parentRoom == null) {
        return null
      }
      if (parentRoom.terminal != null && parentRoom.terminal.store.getFreeCapacity() > 1000) {
        return parentRoom.terminal
      }
      return parentRoom.storage ?? null
    })()
    if (store == null) {
      creep.say("no store")
      PrimitiveLogger.fatal(`${this.constructor.name} parent room ${roomLink(this.parentRoomName)} does not have terminal nor storage`)
      return null
    }

    if (creep.store.getFreeCapacity(RESOURCE_POWER) <= 0 || powerResources.length <= 0) {
      if (creep.store.getUsedCapacity(RESOURCE_POWER) > 0) {
        if (creep.room.name !== store.room.name) {
          const waypoints = ((): RoomName[] => {
            if (store.room.name === this.parentRoomName) {
              const reversedWaypoints = [...this.waypoints]
              reversedWaypoints.reverse()
              return reversedWaypoints
            }
            return GameMap.getWaypoints(creep.room.name, store.room.name) ?? []
          })()
          return FleeFromAttackerTask.create(MoveToRoomTask.create(store.room.name, waypoints))
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
    if (this.pickupFinished === true || this.lackOfEnergy === true) {
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

  private runHealers(healers: Creep[], powerBank: StructurePowerBank | null, attackersInRoom: Creep[]): void {
    healers.forEach(creep => this.runHealer(creep, powerBank, attackersInRoom))
  }

  private runHealer(creep: Creep, powerBank: StructurePowerBank | null, attackersInRoom: Creep[]): void {
    const isDamaged = creep.hits < (creep.hitsMax - 200)
    if (isDamaged === true) {
      creep.heal(creep)
    }

    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = this.createMoveToRoomTask(creep)
      return
    }

    const getNearbyDamagedCreeps = (): Creep[] => {
      return creep.room.find(FIND_MY_CREEPS).filter(myCreep => myCreep.hits < myCreep.hitsMax)
    }

    const heal = (healTarget: Creep): void => {
      if (isDamaged === true) {
        return
      }
      const range = creep.pos.getRangeTo(healTarget.pos)
      if (range <= GameConstants.creep.actionRange.heal) {
        creep.heal(healTarget)
      } else if (range <= GameConstants.creep.actionRange.rangedHeal) {
        creep.rangedHeal(healTarget)
        creep.moveTo(healTarget.pos, defaultMoveToOptions())
      } else {
        creep.moveTo(healTarget.pos, defaultMoveToOptions())
      }
    }

    const healDamagedCreep = (): void => {
      const damagedCreep = creep.pos.findClosestByRange(getNearbyDamagedCreeps())
      if (damagedCreep == null) {
        return
      }
      heal(damagedCreep)
    }

    if (powerBank == null) {
      return healDamagedCreep()
    }

    // TODO: 消す
    // if (creep.pos.getRangeTo(powerBank.pos) > 2) {
    //   return MoveToTask.create(powerBank.pos, 2)
    // }

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
        return healDamagedCreep()
      }

      this.attackerHealerPair.push({
        attackerName: healerLessAttacker.name,
        healerName: creep.name,
      })

      return heal(healerLessAttacker)
    }

    const pairedAttacker = Game.creeps[healerPair.pair.attackerName]
    if (pairedAttacker == null) {
      this.attackerHealerPair.splice(healerPair.index, 1)
      return
    }
    return heal(pairedAttacker)
  }

  // ---- Attacker ---- //
  private addAttacker(): void {
    if (this.pickupFinished === true || this.lackOfEnergy === true) {
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

  private runAttackers(attackers: Creep[], powerBank: StructurePowerBank | null, haulerReady: boolean): void {
    attackers.forEach(creep => this.runAttacker(creep, powerBank, haulerReady))
  }

  private runAttacker(creep: Creep, powerBank: StructurePowerBank | null, haulerReady: boolean): void {
    if (this.pickupFinished === true) {
      const nearbyHauler = this.nearbyHostileHauler(creep)
      if (nearbyHauler != null) {
        creep.moveTo(nearbyHauler, defaultMoveToOptions())
        creep.attack(nearbyHauler)
        return
      }
    }
    const hostileCreep = creep.pos.findInRange(FIND_HOSTILE_CREEPS, GameConstants.creep.actionRange.attack)
      .filter(hostileCreep => {
        return this.whitelistedUsernames.includes(hostileCreep.owner.username) !== true
      })[0]
    if (hostileCreep != null && hostileCreep.getActiveBodyparts(ATTACK) <= 0) {
      creep.attack(hostileCreep)
      return
    }

    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = this.createMoveToRoomTask(creep)
      return
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
        if (creep.pos.getRangeTo(powerBank.pos) > 1) {
          creep.moveTo(powerBank.pos, defaultMoveToOptions())
        }
        creep.attack(powerBank)
        return
      } else {
        // creep.say("waiting")
        return
      }
    }

    const nearbyHauler = this.nearbyHostileHauler(creep)
    if (nearbyHauler != null) {
      creep.moveTo(nearbyHauler, defaultMoveToOptions())
      creep.attack(nearbyHauler)
      return
    }

    if (this.powerBankInfo == null) {
      return
    }
    try {
      const waitingPosition = new RoomPosition(25, 25, this.targetRoomName)
      if (creep.pos.getRangeTo(waitingPosition) > 4) {
        creep.moveTo(waitingPosition, defaultMoveToOptions())
      }
      return
    } catch {
      return
    }
    // const emptyHauler = creep.pos.findInRange(emptyHaulers, 1)[0]
    // const powerBankPosition = decodeRoomPosition(this.powerBankInfo.position, this.targetRoomName)
    // if (emptyHauler == null) {
    //   return MoveToTask.create(powerBankPosition, 1)
    // }
    // if (creep.pos.isNearTo(powerBankPosition) === true) {
    //   return MoveToTask.create(emptyHauler.pos, 0)
    // } else {
    //   return MoveToTask.create(powerBankPosition, 1)
    // }
  }

  private nearbyHostileHauler(creep: Creep): Creep | null {
    return creep.pos.findClosestByRange(creep.room.find(FIND_HOSTILE_CREEPS).filter(hostileCreep => {
      if (this.whitelistedUsernames.includes(hostileCreep.owner.username) === true) {
        return false
      }
      return (hostileCreep.getActiveBodyparts(CARRY) > 0)
    }))
  }

  // ---- Scout ---- //
  private addScout(): void {
    if (this.pickupFinished === true || this.lackOfEnergy === true) {
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
      this.createMoveToRoomTask(creep),
      MoveToTask.create(waitingPosition, range),
    ]
    return FleeFromAttackerTask.create(SequentialTask.create(tasks, options))
  }

  private createMoveToRoomTask(creep: Creep): MoveToRoomTask {
    const waypoints: RoomName[] = creep.room.name === this.parentRoomName ? this.waypoints : []
    return MoveToRoomTask.create(this.targetRoomName, waypoints)
  }
}

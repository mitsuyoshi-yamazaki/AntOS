import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { CreepName, defaultMoveToOptions } from "prototype/creep"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepBody } from "utility/creep_body"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { decodeRoomPosition, RoomPositionFilteringOptions } from "prototype/room_position"
import { processLog } from "os/infrastructure/logger"
import { Timestamp } from "shared/utility/timestamp"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { GameConstants } from "utility/constants"
import { coloredText, profileLink, roomLink } from "utility/log"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { calculateTowerDamage } from "utility/tower"
import { } from "./tower_interception"
import { ValuedArrayMap } from "shared/utility/valued_collection"
import { OwnedRoomProcess } from "process/owned_room_process"

ProcessDecoder.register("DefenseRoomProcess", state => {
  return DefenseRoomProcess.decode(state as DefenseRoomProcessState)
})

const attackerRoles: CreepRole[] = [CreepRole.Attacker]
const repairerRoles: CreepRole[] = [CreepRole.Worker]

const logs: string[] = []
function addLog(message: string): void {
  if (logs.includes(message) === true) {
    return
  }
  logs.push(message)
  PrimitiveLogger.notice(message)
}

type HostileInfo = {
  readonly clusters: HostileCluster[]
  readonly totalAttackerCreepCount: number
  readonly totalHealPower: number
  readonly largestTicksToLive: number
  readonly boosted: boolean
}

type HostileCluster = {
  readonly hostileCreeps: {
    readonly creep: Creep,
    readonly info: HostileCreepInfo,
  }[]
  readonly totalHealPower: number
  readonly boosted: boolean
}

type HostileCreepInfo = {
  readonly isAttacker: boolean
  readonly boosted: boolean
  readonly healPower: number
}

type ClusterTargetInfo = {
  readonly cluster: HostileCluster,
  readonly intercepterCreeps: Creep[],
  readonly closestRamparts: {
    readonly ramparts: StructureRampart[],
    readonly closestHostileCreep: Creep,
    readonly range: number
  } | null
}

const attackerBodyParts: BodyPartConstant[] = [
  ATTACK,
  RANGED_ATTACK,
  HEAL,
  CLAIM,
  WORK,
]

interface DefenseRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly receivedEnergyTimestamp: Timestamp
  readonly intercepterTargets: { [intercepterName: string]: Id<Creep> }
}

export class DefenseRoomProcess implements Process, Procedural, OwnedRoomProcess {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private readonly codename: string

  private readonly hostileCreepInfo = new Map<Id<Creep>, HostileCreepInfo>()
  private excludedRampartIds: Id<StructureRampart>[] | null = null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private receivedEnergyTimestamp: Timestamp,
    private intercepterTargets: { [intercepterName: string]: Id<Creep> },
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): DefenseRoomProcessState {
    return {
      t: "DefenseRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      receivedEnergyTimestamp: this.receivedEnergyTimestamp,
      intercepterTargets: this.intercepterTargets,
    }
  }

  public static decode(state: DefenseRoomProcessState): DefenseRoomProcess {
    return new DefenseRoomProcess(state.l, state.i, state.roomName, state.receivedEnergyTimestamp, state.intercepterTargets ?? {})
  }

  public static create(processId: ProcessId, roomName: RoomName): DefenseRoomProcess {
    return new DefenseRoomProcess(Game.time, processId, roomName, 0, {})
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName)
    ]
    if (this.receivedEnergyTimestamp > 0) {
      const interval = Game.time - this.receivedEnergyTimestamp
      if (interval > 9999) {
        descriptions.push(`energy sent ${Math.floor(interval / 1000)}k ticks ago`)
      } else {
        descriptions.push(`energy sent ${interval} ticks ago`)
      }
    }
    return descriptions.join(" ")
  }

  public runOnTick(): void {
    const roomResources = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResources == null) {
      return
    }
    // const hostileCreeps = [...roomResources.hostiles.creeps]
    // const hostileBoostedCreeps = [...hostileCreeps].filter(hostileCreep => hostileCreep.body.some(body => body.boost != null))

    const intercepters: Creep[] = []
    const repairers: Creep[] = []

    const processCreeps = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier)
    processCreeps.forEach(creep => {
      if (hasNecessaryRoles(creep, attackerRoles) === true) {
        intercepters.push(creep)
        return
      }
      if (hasNecessaryRoles(creep, repairerRoles) === true) {
        repairers.push(creep)
        return
      }
    })

    const hostileInfo = this.getHostileInfo(roomResources)

    // TODO: Power Creepの判定
    if (hostileInfo == null || hostileInfo.clusters.length <= 0) {
      this.hostileCreepInfo.clear()
      this.intercepterTargets = {}
      this.waitIntercepters(intercepters, roomResources)
      return
    }

    this.notice(hostileInfo)

    const totalHealPower = roomResources.hostiles.creeps.reduce((result, current) => {
      return result + CreepBody.power(current.body, "heal")
    }, 0)

    if (hostileInfo.boosted === true) {
      const unboostedIntercepters: Creep[] = []
      const boostedIntercepters: Creep[] = []
      intercepters.forEach(creep => {
        if (creep.ticksToLive == null || creep.ticksToLive < 100) {
          boostedIntercepters.push(creep)
          return
        }
        if (creep.body.some(body => body.boost != null)) {
          boostedIntercepters.push(creep)
        } else {
          unboostedIntercepters.push(creep)
        }
      })
      const boostLabs = roomResources.roomInfoAccessor.getBoostLabs()
      const boostLab = boostLabs
        .flatMap((labInfo): StructureLab[] => {
          const lab = Game.getObjectById(labInfo.labId)
          if (lab == null) {
            return []
          }
          return [lab]
        })
        .find(lab => {
          if (lab.store.getUsedCapacity(RESOURCE_UTRIUM_HYDRIDE) > 0) {
            return true
          }
          return false
        })

      if (totalHealPower > 1500 && boostLab != null) {
        this.boostIntercepters(unboostedIntercepters, boostLab)
        this.runIntercepters(boostedIntercepters, hostileInfo.clusters, roomResources)
      } else {
        this.runIntercepters(intercepters, hostileInfo.clusters, roomResources)
      }
    } else {
      this.runIntercepters(intercepters, hostileInfo.clusters, roomResources)
    }

    // TODO:
    // this.runRepairers(repairers, hostileCreeps)

    const intercepterMaxCount = ((): number => {
      if (roomResources.controller.safeMode != null && roomResources.controller.safeMode > 200) {
        return 0
      }

      const largestTicksToLive = hostileInfo.largestTicksToLive
      if (largestTicksToLive < 200) {
        return 0
      }
      if (totalHealPower <= 0) {
        return 0
      }

      if (hostileInfo.boosted !== true) {
        const defeatableHeal = (roomResources.activeStructures.towers.length * 150) * 0.9
        if (totalHealPower < defeatableHeal) {
          return 0
        }
        if (totalHealPower < (defeatableHeal * 2)) {
          return 1
        }
        return 2
      }
      if (hostileInfo.totalAttackerCreepCount <= 1) {
        return 2
      }
      return Math.max(hostileInfo.clusters.length, 3)
    })()

    const energyCapacityAvailable = roomResources.room.energyCapacityAvailable
    if (intercepters.length < intercepterMaxCount && energyCapacityAvailable > 1000) {
      const small = intercepters.length <= 0
      this.spawnIntercepter(small, energyCapacityAvailable)
    }

    if (intercepters.length > 0 && roomResources.hostiles.creeps.length > 0) {
      const minimumEnergyTransferDuration = 1000
      if ((this.receivedEnergyTimestamp + minimumEnergyTransferDuration) < Game.time) {
        if (this.needsEnergy(roomResources) === true) {
          this.collectEnergy(roomResources)
        }
      }
    }
  }

  private boostIntercepters(intercepters: Creep[], lab: StructureLab): void {
    intercepters.forEach(creep => this.boostIntercepter(creep, lab))
  }

  private boostIntercepter(creep: Creep, lab: StructureLab): void {
    if (lab.pos.getRangeTo(creep) <= 1) {
      lab.boostCreep(creep)
      return
    }

    creep.say("boost!")
    creep.moveTo(lab.pos, defaultMoveToOptions())
  }

  private runIntercepters(intercepters: Creep[], hostileClusters: HostileCluster[], roomResource: OwnedRoomResource): void {
    if (intercepters.some(creep => creep.spawning !== true) !== true) {
      return
    }

    const allRamparts = (roomResource.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } }) as StructureRampart[])
    const excludedRampartIds = ((): Id<StructureRampart>[] => {
      if (this.excludedRampartIds != null) {
        return this.excludedRampartIds
      }
      const excluded = roomResource.roomInfoAccessor.config.nonHidableRampartIds
      this.excludedRampartIds = allRamparts.flatMap((rampart): Id<StructureRampart>[] => {
        if (excluded.includes(rampart.id) === true) {
          return [rampart.id]
        }
        if (rampart.pos.findInRange(FIND_MY_STRUCTURES, 0).length > 1) {
          return [rampart.id]
        }
        return []
      })
      return this.excludedRampartIds
    })()

    const allHidableRamparts = allRamparts
      .filter(rampart => {
        if (excludedRampartIds.includes(rampart.id) === true) {
          return false
        }
        if (rampart.hits < 10000) {
          return false
        }
        return true
      })

    // Assign Intercepters
    const waitingIntercepters = intercepters.reduce((result, current) => {
      result.set(current.name, current)
      return result
    }, new Map<CreepName, Creep>())
    // const minimumRampartRange = 15

    const targetByIntercepter = new ValuedArrayMap<Id<Creep>, CreepName>()
    Array.from(Object.entries(this.intercepterTargets)).forEach(([intercepterName, targetCreepId]) => {
      const intercepterNameList = targetByIntercepter.getValueFor(targetCreepId)
      intercepterNameList.push(intercepterName)
      targetByIntercepter.set(targetCreepId, intercepterNameList)
    })

    const getTargetingIntercepters = (cluster: HostileCluster): Creep[] => {
      const intercepterCreeps: Creep[] = []
      cluster.hostileCreeps.forEach(hostileCreep => {
        const intercepterNames = targetByIntercepter.get(hostileCreep.creep.id)
        if (intercepterNames == null) {
          return
        }

        intercepterNames.forEach(intercepterName => {
          const intercepter = waitingIntercepters.get(intercepterName)
          if (intercepter == null) {
            delete this.intercepterTargets[intercepterName]
            return
          }
          waitingIntercepters.delete(intercepterName)
          intercepterCreeps.push(intercepter)
        })
      })
      return intercepterCreeps
    }

    const clusterTargetInfo = hostileClusters.map((cluster): ClusterTargetInfo => {
      const closestRamparts = cluster.hostileCreeps.reduce((result, current) => {
        const closest = current.creep.pos.findClosestByRange(allHidableRamparts)
        if (closest == null) {
          return result
        }
        const range = current.creep.pos.getRangeTo(closest)
        if (result == null || range < result.range) {
          return {
            ramparts: [closest],
            closestHostileCreep: current.creep,
            range: range,
          }
        }
        if (range === result.range) {
          result.ramparts.push(closest)
        }
        return result
      }, null as { ramparts: StructureRampart[], closestHostileCreep: Creep, range: number } | null)

      if (closestRamparts == null) {
        return {
          cluster,
          intercepterCreeps: getTargetingIntercepters(cluster),
          closestRamparts: null,
        }
      }

      // Intercepterのreassignが煩雑になるため一旦考えない
      // if (closestRamparts.range  > minimumRampartRange) {
      //   cluster.hostileCreeps.forEach(hostileCreep => {
      //     const targetingIntercepterNames = targetByIntercepter.get(hostileCreep.creep.id)
      //     targetingIntercepterNames?.forEach(intercepterName => {
      //       delete this.intercepterTargets[intercepterName]
      //     })
      //   })

      //   return {
      //     cluster,
      //     intercepterCreeps: [],
      //     closestRamparts,
      //   }
      // }

      return {
        cluster,
        intercepterCreeps: getTargetingIntercepters(cluster),
        closestRamparts,
      }
    })

    const assignIntercepters = (intercepterCreeps: Creep[]): void => {
      intercepterCreeps.forEach(intercepter => {
        clusterTargetInfo.sort((lhs, rhs) => lhs.intercepterCreeps.length - rhs.intercepterCreeps.length)
        if (clusterTargetInfo[0] == null || clusterTargetInfo[0].cluster.hostileCreeps[0] == null) {
          return
        }
        clusterTargetInfo[0].intercepterCreeps.push(intercepter)
        const targetId = clusterTargetInfo[0].cluster.hostileCreeps[0].creep.id
        this.intercepterTargets[intercepter.name] = targetId
      })
    }

    const availableIntercepters = Array.from(waitingIntercepters.values())
    assignIntercepters(availableIntercepters)

    if (clusterTargetInfo.some(cluster => cluster.intercepterCreeps.length <= 0)) {
      const reassigningIntercepters: Creep[] = []
      clusterTargetInfo.forEach(cluster => {
        if (cluster.intercepterCreeps.length <= 1) {
          return
        }
        const creep = cluster.intercepterCreeps.pop()
        if (creep == null) {
          return
        }
        delete this.intercepterTargets[creep.name]
        reassigningIntercepters.push(creep)
      })

      assignIntercepters(reassigningIntercepters)
    }

    // ---- ---- //
    const obstacleCost = GameConstants.pathFinder.costs.obstacle
    const hostileCreeps = hostileClusters.flatMap(cluster => cluster.hostileCreeps.map(info => info.creep))
    const costCallback = (roomName: string, costMatrix: CostMatrix): void | CostMatrix => {
      if (roomName !== this.roomName) {
        return costMatrix
      }

      const positionOptions: RoomPositionFilteringOptions = {
        excludeItself: false,
        excludeStructures: false,
        excludeTerrainWalls: false,
        excludeWalkableStructures: false,
      }

      hostileCreeps.forEach(creep => {
        const attackRange = ((): number => {
          if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
            return GameConstants.creep.actionRange.rangedAttack
          }
          if (creep.getActiveBodyparts(ATTACK) > 0) {
            return GameConstants.creep.actionRange.attack
          }
          return 0
        })()

        const avoidRange = attackRange + 2

        creep.pos.positionsInRange(avoidRange, positionOptions).forEach(position => {
          const range = position.getRangeTo(creep.pos)
          const cost = obstacleCost - range
          costMatrix.set(position.x, position.y, cost)
        })
      })

      allHidableRamparts.forEach(rampart => {
        costMatrix.set(rampart.pos.x, rampart.pos.y, 1)
      })
    }

    clusterTargetInfo.forEach(targetInfo => this.runInterceptersToTarget(targetInfo, roomResource, costCallback))
  }

  private runInterceptersToTarget(clusterTargetInfo: ClusterTargetInfo, roomResource: OwnedRoomResource, costCallback: (roomName: string, costMatrix: CostMatrix) => void | CostMatrix): void {
    const getCenterPosition = (): RoomPosition => {
      try {
        if (roomResource.roomInfo.roomPlan?.centerPosition != null) {
          return decodeRoomPosition(roomResource.roomInfo.roomPlan.centerPosition, roomResource.room.name)
        }
        return roomResource.activeStructures.storage?.pos ?? new RoomPosition(25, 25, roomResource.room.name)
      } catch (error) {
        return new RoomPosition(25, 25, roomResource.room.name)
      }
    }

    const hostileCreeps = clusterTargetInfo.cluster.hostileCreeps.map(info => info.creep)
    const targetHostileCreep = ((): Creep | null => {
      if (clusterTargetInfo.closestRamparts?.closestHostileCreep != null) {
        return clusterTargetInfo.closestRamparts.closestHostileCreep
      }
      return getCenterPosition().findClosestByRange(hostileCreeps) ?? null
    })()
    if (targetHostileCreep == null) {
      return
    }
    const targetPosition = targetHostileCreep.pos

    const interceptersInRange = targetHostileCreep.pos.findInRange(clusterTargetInfo.intercepterCreeps, 2)
    if (interceptersInRange.length > 0) {
      const totalHealPower = targetHostileCreep.pos.findInRange(FIND_HOSTILE_CREEPS, 1).reduce((result, current) => {
        return result + CreepBody.power(current.body, "heal")
      }, 0)
      const totalIntercepterAttackPower = interceptersInRange.reduce((result, current) => {
        return result + CreepBody.power(current.body, "attack")
      }, 0)
      const totalTowerAttackPower = roomResource.activeStructures.towers.reduce((result, current) => {
        if (current.store.getUsedCapacity(RESOURCE_ENERGY) < 10) {
          return result
        }
        return result + calculateTowerDamage(current.pos.getRangeTo(targetPosition))
      }, 0)
      const totalAttackPower = totalIntercepterAttackPower + totalTowerAttackPower

      if ((totalAttackPower * 1) > totalHealPower) {
        clusterTargetInfo.intercepterCreeps.forEach(creep => this.moveIntercepterToTarget(creep, targetPosition, false))
        return
      }
    }

    const closestRamparts: StructureRampart[] = clusterTargetInfo.closestRamparts?.ramparts ?? []
    const nearbyRamparts: StructureRampart[] = []
    closestRamparts.forEach(rampart => {
      const nearBy = rampart.pos.findInRange(FIND_MY_STRUCTURES, 1, { filter: { structureType: STRUCTURE_RAMPART } }) as StructureRampart[]
      nearbyRamparts.push(...nearBy.filter(r => {
        if (closestRamparts.includes(r) === true) {
          return false
        }
        if (nearbyRamparts.includes(r) === true) {
          return false
        }
        return true
      }))
    })

    const hidableRamparts: StructureRampart[] = [
      ...closestRamparts,
      ...nearbyRamparts,
    ]
    if (hidableRamparts.length <= 0) {
      clusterTargetInfo.intercepterCreeps.forEach(creep => this.moveIntercepterToTarget(creep, targetPosition, true))
      return
    }

    for (let i = 0; i < clusterTargetInfo.intercepterCreeps.length; i += 1) {
      const creep = clusterTargetInfo.intercepterCreeps[i]
      const rampart = hidableRamparts[i % hidableRamparts.length]
      if (creep == null || rampart == null) {
        processLog(this, "1")
        continue
      }
      this.moveIntercepterToRampart(creep, rampart.pos, true, costCallback)
    }
  }

  private moveIntercepterToTarget(creep: Creep, targetPosition: RoomPosition, say: boolean): void {
    if (creep.spawning === true) {
      return
    }
    const moveToOpt: MoveToOpts = {
      ignoreCreeps: false,
    }
    if (creep.pos.isEqualTo(targetPosition) === true) {
      // do nothing
    } else {
      if (say === true) {
        creep.say(`${targetPosition.x},${targetPosition.y}`)
      }
      creep.moveTo(targetPosition, moveToOpt)
    }
    const targets = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 1)
    if (targets[0] != null) {
      creep.attack(targets[0])
    }
  }

  private moveIntercepterToRampart(creep: Creep, rampartPosition: RoomPosition, say: boolean, costCallback: (roomName: string, costMatrix: CostMatrix) => void | CostMatrix): void {
    if (creep.spawning === true) {
      return
    }
    const moveToOpt: MoveToOpts = {
      ignoreCreeps: false,
      costCallback,
    }
    if (creep.pos.isEqualTo(rampartPosition) === true) {
      // do nothing
    } else {
      if (say === true) {
        creep.say(`${rampartPosition.x},${rampartPosition.y}`)
      }
      creep.moveTo(rampartPosition, moveToOpt)
    }
    const targets = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 1)
    if (targets[0] != null) {
      creep.attack(targets[0])
    }
  }

  private waitIntercepters(intercepters: Creep[], roomResources: OwnedRoomResource): void {
    const waitingIntercepters: Creep[] = []
    const interceptersToUnboost: Creep[] = []

    intercepters.forEach(creep => {
      if (creep.ticksToLive != null && creep.ticksToLive < 25) {
        if (creep.body.some(body => body.boost != null)) {
          interceptersToUnboost.push(creep)
          return
        }
      }
      waitingIntercepters.push(creep)
    })

    if (interceptersToUnboost.length > 0) {
      const researchOutputLabIds = roomResources.roomInfo.researchLab?.outputLabs ?? []
      const unboostLab = researchOutputLabIds.flatMap((labId): StructureLab[] => {
        const lab = Game.getObjectById(labId)
        if (!(lab instanceof StructureLab)) {
          return []
        }
        if (lab.cooldown > 0) {
          return []
        }
        return [lab]
      })[0]

      if (unboostLab != null) {
        interceptersToUnboost.forEach(creep => this.unboostIntercepter(creep, unboostLab))
      }
    }

    const interceptersOutsideRamparts = waitingIntercepters.filter(creep => {
      if (creep.pos.findInRange(FIND_MY_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length > 0) {
        // creep.say("safe")
        return false
      }
      return true
    })

    if (interceptersOutsideRamparts.length <= 0) {
      return
    }
    const ramparts = roomResources.ramparts.filter(rampart => { // 1~2CPU/tick
      if (rampart.pos.findInRange(FIND_STRUCTURES, 0).length > 1) {  // 1はRampartの分, FIND_MY_STRUCTUREを使わないのはRoadを避けるため
        return false
      }
      if (rampart.pos.findInRange(FIND_MY_CREEPS, 0).length > 0) {
        return false
      }
      return true
    })
    if (ramparts.length <= 0) {
      interceptersOutsideRamparts[0]?.say("no rampart")
      return
    }
    interceptersOutsideRamparts.forEach(creep => this.waitIntercepter(creep, ramparts))
  }

  private waitIntercepter(creep: Creep, ramparts: StructureRampart[]): void {
    const closestRampart = creep.pos.findClosestByPath(ramparts)
    if (closestRampart == null) {
      creep.say("no dest")
      return
    }
    creep.say(`${closestRampart.pos.x},${closestRampart.pos.y}`)
    if (creep.pos.isEqualTo(closestRampart.pos) !== true) {
      creep.moveTo(closestRampart.pos, defaultMoveToOptions())
    }
  }

  private unboostIntercepter(creep: Creep, lab: StructureLab): void {
    if (lab.pos.getRangeTo(creep) <= 1) {
      lab.unboostCreep(creep)
      return
    }

    creep.say("unboost")
    creep.moveTo(lab.pos, defaultMoveToOptions())
  }

  private spawnIntercepter(small: boolean, energyCapacity: number): void {
    const bodyUnit = [MOVE, ATTACK, ATTACK]
    const unitMaxCount = ((): number => {
      if (small === true) {
        return 8
      }
      return Math.floor(50 / bodyUnit.length)
    })()
    const body = CreepBody.create([], bodyUnit, energyCapacity, unitMaxCount)
    body.sort((lhs, rhs) => {
      if (lhs === rhs) {
        return 0
      }
      return lhs === ATTACK ? -1 : 1
    })

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Urgent,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: attackerRoles,
      body: body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  // ---- Repairer ---- //
  private runRepairers(repairers: Creep[], hostileCreeps: Creep[]): void {

  }

  private spawnRepairer(energyCapacity: number): void {
    const bodyUnit = [CARRY, MOVE, WORK]
    const unitMaxCount = Math.min(10, Math.floor(50 / bodyUnit.length))
    const body = CreepBody.create([], bodyUnit, energyCapacity, unitMaxCount)

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: repairerRoles,
      body: body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  // ---- Cluster ---- //
  private getHostileInfo(roomResource: OwnedRoomResource): HostileInfo | null {
    let largestTicksToLive = 0
    let boosted = false as boolean
    const attackerCreeps = new Map<Id<Creep>, {creep: Creep, info: HostileCreepInfo}>()

    roomResource.hostiles.creeps.forEach(creep => {
      const info = this.getHostileCreepInfo(creep)
      if (info.isAttacker !== true) {
        return
      }
      if (creep.ticksToLive != null && creep.ticksToLive > largestTicksToLive) {
        largestTicksToLive = creep.ticksToLive
      }
      if (boosted !== true && info.boosted === true) {
        boosted = true
      }
      attackerCreeps.set(creep.id, {
        creep,
        info,
      })
    })

    const totalAttackerCreepCount = attackerCreeps.size
    if (totalAttackerCreepCount <= 0) {
      return null
    }

    const clusterCreepRange = 2
    const findCluster = (creep: { creep: Creep, info: HostileCreepInfo }): { creep: Creep, info: HostileCreepInfo }[] => {
      attackerCreeps.delete(creep.creep.id)
      const creepPosition = creep.creep.pos
      const nearbyCreeps = Array.from(attackerCreeps.values()).filter(creepInfo => creepInfo.creep.pos.getRangeTo(creepPosition) <= clusterCreepRange)

      const creepsInCluster: { creep: Creep, info: HostileCreepInfo }[] = [
        creep,
        ...nearbyCreeps.flatMap(nearbyCreep => findCluster(nearbyCreep))
      ]
      return creepsInCluster
    }

    const clusters: HostileCluster[] = []
    const maxTrial = 10
    for (let i = 0; i < maxTrial; i += 1) {
      const creepInfo = Array.from(attackerCreeps.values())[0]
      if (creepInfo == null) {
        break
      }

      const hostileCreeps = findCluster(creepInfo)
      const clusterHealPower = hostileCreeps.reduce((result, current) => {
        return result + current.info.healPower
      }, 0)
      const clusterBoosted = hostileCreeps.some(creep => creep.info.boosted)

      clusters.push({
        hostileCreeps,
        totalHealPower: clusterHealPower,
        boosted: clusterBoosted,
      })
    }

    if (attackerCreeps.size > 0) {
      const hostileCreeps = Array.from(attackerCreeps.values())
      const clusterHealPower = hostileCreeps.reduce((result, current) => {
        return result + current.info.healPower
      }, 0)
      const clusterBoosted = hostileCreeps.some(creep => creep.info.boosted)

      clusters.push({
        hostileCreeps,
        totalHealPower: clusterHealPower,
        boosted: clusterBoosted,
      })
    }

    const totalHealPower = clusters.reduce((result, current) => (result + current.totalHealPower), 0)
    return {
      clusters,
      totalAttackerCreepCount,
      totalHealPower,
      largestTicksToLive,
      boosted,
    }
  }

  // ---- Hostile Creep ---- //
  private getHostileCreepInfo(creep: Creep): HostileCreepInfo {
    const stored = this.hostileCreepInfo.get(creep.id)
    if (stored != null) {
      return stored
    }

    let isAttacker = false as boolean
    let boosted = false as boolean

    for (const body of creep.body) {
      if (isAttacker === true && boosted === true) {
        break
      }
      if (isAttacker !== true) {
        if (attackerBodyParts.includes(body.type) === true) {
          isAttacker = true
        }
      }
      if (boosted !== true) {
        if (body.boost != null) {
          boosted = true
        }
      }
    }

    const healPower = CreepBody.power(creep.body, "heal")

    return {
      isAttacker,
      boosted,
      healPower,
    }
  }

  // ---- Energy ---- //
  private needsEnergy(roomResources: OwnedRoomResource): boolean {
    const minimumEnergyAmount = 50000
    return roomResources.getResourceAmount(RESOURCE_ENERGY) < minimumEnergyAmount
  }

  private collectEnergy(roomResources: OwnedRoomResource): void {
    if (roomResources.activeStructures.terminal == null) {
      return
    }

    const energyAmount = 15000
    const energySendableTerminals = RoomResources.getOwnedRoomResources()
      .flatMap((resources: OwnedRoomResource): { terminal: StructureTerminal, roomDistance: number }[] => {
        if (resources.room.name === roomResources.room.name) {
          return []
        }
        if (resources.hostiles.creeps.length > 0) {
          return []
        }
        const terminal = resources.activeStructures.terminal
        if (terminal == null) {
          return []
        }
        if (terminal.store.getUsedCapacity(RESOURCE_ENERGY) < (energyAmount * 2)) {
          return []
        }
        return [{
          terminal,
          roomDistance: Game.map.getRoomLinearDistance(roomResources.room.name, resources.room.name)
        }]
      })

    energySendableTerminals.sort((lhs, rhs) => {
      return lhs.roomDistance - rhs.roomDistance
    })

    const maxAmount = 45000
    let sentAmount = 0

    energySendableTerminals.forEach(obj => {
      if (sentAmount >= maxAmount) {
        return
      }
      const result = obj.terminal.send(RESOURCE_ENERGY, energyAmount, roomResources.room.name)
      switch (result) {
      case OK:
        sentAmount += energyAmount
        processLog(this, `${coloredText("[INFO]", "info")} ${energyAmount} energy sent to ${roomLink(roomResources.room.name)}`)
        break

      case ERR_TIRED:
        break

      case ERR_NOT_OWNER:
      case ERR_NOT_ENOUGH_RESOURCES:
      case ERR_INVALID_ARGS:
        PrimitiveLogger.programError(`${this.taskIdentifier} terminal.send(${roomLink(obj.terminal.room.name)}, energy, ${roomLink(roomResources.room.name)}) failed with ${result}`)
        break
      }
    })

    if (sentAmount > 0) {
      this.receivedEnergyTimestamp = Game.time
    }
  }

  // ---- Notice ---- //
  private notice(hostileInfo: HostileInfo): void {
    const timestamp = Math.floor(Game.time / 500) * 500

    if (hostileInfo.clusters.length <= 1 || hostileInfo.totalHealPower < 1000) {
      return
    }

    const usernames: string[] = []
    hostileInfo.clusters
      .forEach(cluster => {
        cluster.hostileCreeps.forEach(hostileCreep => {
          const username = hostileCreep.creep.owner.username
          if (usernames.includes(username) === true) {
            return
          }
          usernames.push(username)
        })
      })

    const profiles = usernames.map(username => profileLink(username)).join(", ")

    addLog(`${roomLink(this.roomName)} is attacked by ${hostileInfo.clusters.length} hostile clusters (${profiles}) with ${hostileInfo.totalHealPower} heals at ${timestamp}`)
  }
}

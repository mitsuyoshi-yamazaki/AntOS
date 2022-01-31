import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { defaultMoveToOptions } from "prototype/creep"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepBody } from "utility/creep_body"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { decodeRoomPosition } from "prototype/room_position"
import { processLog } from "os/infrastructure/logger"
import { Timestamp } from "utility/timestamp"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { GameConstants } from "utility/constants"
import { coloredText, roomLink } from "utility/log"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { calculateTowerDamage } from "utility/tower"

ProcessDecoder.register("DefenseRoomProcess", state => {
  return DefenseRoomProcess.decode(state as DefenseRoomProcessState)
})

const attackerRoles: CreepRole[] = [CreepRole.Attacker]
const repairerRoles: CreepRole[] = [CreepRole.Worker]

interface DefenseRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly currentTargetId: Id<AnyCreep> | null
  readonly respondBoostedOnly: boolean
  readonly receivedEnergyTimestamp: Timestamp
}

export class DefenseRoomProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly currentTargetId: Id<AnyCreep> | null,
    private respondBoostedOnly: boolean,
    private receivedEnergyTimestamp: Timestamp,
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
      currentTargetId: this.currentTargetId,
      respondBoostedOnly: this.respondBoostedOnly,
      receivedEnergyTimestamp: this.receivedEnergyTimestamp,
    }
  }

  public static decode(state: DefenseRoomProcessState): DefenseRoomProcess {
    return new DefenseRoomProcess(state.l, state.i, state.roomName, state.currentTargetId, state.respondBoostedOnly ?? false, state.receivedEnergyTimestamp ?? 0)
  }

  public static create(processId: ProcessId, roomName: RoomName): DefenseRoomProcess {
    return new DefenseRoomProcess(Game.time, processId, roomName, null, true, 0)
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
    const hostileCreeps = [...roomResources.hostiles.creeps]
    const hostileBoostedCreeps = [...hostileCreeps].filter(hostileCreep => hostileCreep.body.some(body => body.boost != null))

    const intercepters: Creep[] = []
    const repairers: Creep[] = []

    const processCreeps = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)
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

    // TODO: Power Creepの判定
    if (hostileCreeps.length <= 0) {
      this.waitIntercepters(intercepters, roomResources)
      return
    }

    if (hostileBoostedCreeps.length > 0) {
      this.runIntercepters(intercepters, hostileBoostedCreeps, roomResources)
    } else {
      this.runIntercepters(intercepters, hostileCreeps, roomResources)
    }

    this.runRepairers(repairers, hostileCreeps)

    const largestTicksToLive = hostileCreeps.reduce((result, current) => {
      if (current.ticksToLive == null) {
        return result
      }
      if (current.ticksToLive > result) {
        return current.ticksToLive
      }
      return result
    }, 0)
    const intercepterMaxCount = ((): number => {
      if (largestTicksToLive < 200) {
        return 0
      }
      if (hostileBoostedCreeps.length <= 0) {
        const defeatableHealCounts = ((roomResources.activeStructures.towers.length * 150) / GameConstants.creep.actionPower.heal) * 0.9
        const numberOfHealParts = hostileCreeps.reduce((result, current) => {
          return result + current.body.filter(body => body.type === HEAL).length
        }, 0)
        if (numberOfHealParts < defeatableHealCounts) {
          return 0
        }
        if (numberOfHealParts < (defeatableHealCounts * 2)) {
          return 1
        }
        return 2
      }
      if (hostileCreeps.length <= 1) {
        return 2
      }
      return 4
    })()
    if (intercepters.length < intercepterMaxCount) {
      const small = intercepters.length <= 0
      this.spawnIntercepter(small, roomResources.room.energyCapacityAvailable)
    }

    const minimumEnergyTransferDuration = 1000
    if ((this.receivedEnergyTimestamp + minimumEnergyTransferDuration) < Game.time) {
      if (this.needsEnergy(roomResources) === true) {
        this.collectEnergy(roomResources)
      }
    }
  }

  private runIntercepters(intercepters: Creep[], hostileCreeps: Creep[], roomResource: OwnedRoomResource): void {
    const centerPosition = ((): RoomPosition => {
      try {
        if (roomResource.roomInfo.roomPlan?.centerPosition != null) {
          return decodeRoomPosition(roomResource.roomInfo.roomPlan.centerPosition, roomResource.room.name)
        }
        return roomResource.activeStructures.storage?.pos ?? new RoomPosition(25, 25, roomResource.room.name)
      } catch (error) {
        return new RoomPosition(25, 25, roomResource.room.name)
      }
    })()
    const targetHostileCreep = centerPosition.findClosestByRange(hostileCreeps)
    if (targetHostileCreep == null) {
      return
    }
    const targetPosition = targetHostileCreep.pos

    const isCloseEnough = targetHostileCreep.pos.findInRange(intercepters, 2).length > 0
    if (isCloseEnough === true) {
      const totalHealPower = targetHostileCreep.pos.findInRange(FIND_HOSTILE_CREEPS, 1).reduce((result, current) => {
        return result + CreepBody.power(current.body, "heal")
      }, 0)
      const totalIntercepterAttackPower = intercepters.reduce((result, current) => {
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
        intercepters.forEach(creep => this.moveIntercepter(creep, targetPosition))
        return
      }
    }

    const allRamparts = roomResource.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } }) as StructureRampart[]
    let closestRange = GameConstants.room.edgePosition.max + 1
    let closestRamparts: StructureRampart[] = []
    allRamparts.forEach(rampart => {
      const range = targetHostileCreep.pos.getRangeTo(rampart.pos)
      if (range < closestRange) {
        closestRange = range
        closestRamparts = [rampart]
      } else if (range === closestRange) {
        closestRamparts.push(rampart)
      }
    })

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
      intercepters.forEach(creep => this.moveIntercepter(creep, targetPosition))
      return
    }

    for (let i = 0; i < intercepters.length; i += 1) {
      const creep = intercepters[i]
      const rampart = hidableRamparts[i % hidableRamparts.length]
      if (creep == null || rampart == null) {
        processLog(this, "1")
        continue
      }
      this.moveIntercepter(creep, rampart.pos)
    }
  }

  private moveIntercepter(creep: Creep, position: RoomPosition): void {
    if (creep.spawning === true) {
      return
    }
    const moveToOpt: MoveToOpts = {
      ignoreCreeps: false
    }
    if (creep.pos.isEqualTo(position) === true) {
      // do nothing
    } else {
      creep.say(`${position.x},${position.y}`)
      creep.moveTo(position, moveToOpt)
    }
    const targets = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 1)
    if (targets[0] != null) {
      creep.attack(targets[0])
    }
  }

  private waitIntercepters(intercepters: Creep[], roomResources: OwnedRoomResource): void {
    const interceptersOutsideRamparts = intercepters.filter(creep => {
      if (creep.pos.findInRange(FIND_MY_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length > 0) {
        creep.say("safe")
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
    creep.moveTo(closestRampart.pos, defaultMoveToOptions())
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
}

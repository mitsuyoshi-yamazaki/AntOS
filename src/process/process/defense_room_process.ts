import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { CreepName } from "prototype/creep"
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

ProcessDecoder.register("DefenseRoomProcess", state => {
  return DefenseRoomProcess.decode(state as DefenseRoomProcessState)
})

const attackerRoles: CreepRole[] = [CreepRole.Attacker]
const repairerRoles: CreepRole[] = [CreepRole.Worker]

interface DefenseRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  // readonly attackerCreepNames: CreepName[]
  // readonly repairerCreepNames: CreepName[]
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
    private readonly roomName: RoomName,
    // private attackerCreepNames: CreepName[],
    // private repairerCreepNames: CreepName[],
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
      // attackerCreepNames: this.attackerCreepNames,
      // repairerCreepNames: this.repairerCreepNames,
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
    return ""
  }

  public runOnTick(): void {
    const roomResources = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResources == null) {
      return
    }
    const hostileCreeps = [...roomResources.hostiles.creeps]
      .filter(hostileCreep => hostileCreep.body.some(body => body.boost != null))

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

    // const attackerCreepNames = [...this.attackerCreepNames]
    // const intercepters = this.parseCreeps(attackerCreepNames)
    // this.attackerCreepNames = intercepters.map(creep => creep.name)
    this.runIntercepters(intercepters, hostileCreeps, roomResources)

    // const repairers = this.parseCreeps(this.repairerCreepNames)
    // this.repairerCreepNames = repairers.map(creep => creep.name)
    this.runRepairers(repairers, hostileCreeps)

    // TODO: Power Creepの判定
    if (hostileCreeps.length > 0) {
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
        if (hostileCreeps.length <= 1) {
          return 2
        }
        return 4
      })()
      if (intercepters.length < intercepterMaxCount) {
        const small = intercepters.length <= 0
        this.spawnIntercepter(small, roomResources.room.energyCapacityAvailable)
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

    const allRamparts = roomResource.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_RAMPART } }) as StructureRampart[]
    let closestRange = GameConstants.room.edgePosition.max + 1
    let closestRamparts: StructureRampart[] = []
    allRamparts.forEach(rampart => {
      const range = targetHostileCreep.pos.getRangeTo(rampart.pos)
      if (range < closestRange) {
        closestRange = range
        closestRamparts = []
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
      intercepters.forEach(creep => this.moveIntercepter(creep, targetHostileCreep.pos))
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

  private parseCreeps(creepNames: CreepName[]): Creep[] {
    return creepNames.flatMap(creepName => {
      const creep = Game.creeps[creepName]
      if (creep == null) {
        return []
      }
      return [creep]
    })
  }
}

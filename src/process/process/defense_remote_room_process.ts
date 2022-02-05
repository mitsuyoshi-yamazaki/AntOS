import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredCreepBody, coloredText, profileLink, roomHistoryLink, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
import { NormalRoomResource } from "room_resource/room_resource/normal_room_resource"
import { CreepBody } from "utility/creep_body"
import { Invader } from "game/invader"
import { GameConstants } from "utility/constants"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { moveToRoom } from "script/move_to_room"
import { GameMap } from "game/game_map"
import { CreepName, defaultMoveToOptions } from "prototype/creep"

ProcessDecoder.register("DefenseRemoteRoomProcess", state => {
  return DefenseRemoteRoomProcess.decode(state as DefenseRemoteRoomProcessState)
})

const rangedAttackRange = GameConstants.creep.actionRange.rangedAttack

type TargetInfo = {
  readonly roomName: RoomName
  readonly attacker: {
    playerNames: string[],
    onlyNpc: boolean,
  },
  readonly totalPower: {
    readonly attack: number
    readonly rangedAttack: number
    readonly heal: number
    readonly hits: number
  }
  readonly hostileCreep: {
    readonly boosted: boolean
    readonly attackerCount: number
    readonly totalCreepCount: number
  }
  readonly priority: number // 大きい方が優先
}

type RoomInfo = {
  readonly name: RoomName
}

interface DefenseRemoteRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRooms: RoomInfo[]
  readonly currentTarget: TargetInfo | null
  readonly intercepterCreepNames: {[roomName: string]: CreepName}
}

// TODO: 事故死の検証
export class DefenseRemoteRoomProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly targetRooms: RoomInfo[],
    private currentTarget: TargetInfo | null,
    private readonly intercepterCreepNames: { [roomName: string]: CreepName },
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): DefenseRemoteRoomProcessState {
    return {
      t: "DefenseRemoteRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRooms: this.targetRooms,
      currentTarget: this.currentTarget,
      intercepterCreepNames: this.intercepterCreepNames,
    }
  }

  public static decode(state: DefenseRemoteRoomProcessState): DefenseRemoteRoomProcess {
    return new DefenseRemoteRoomProcess(state.l, state.i, state.roomName, state.targetRooms, state.currentTarget, state.intercepterCreepNames)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomNames: RoomName[]): DefenseRemoteRoomProcess {
    const targetRooms = targetRoomNames.map((name: RoomName): RoomInfo => ({name}))
    return new DefenseRemoteRoomProcess(Game.time, processId, roomName, targetRooms, null, {})
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName)
    ]
    if (this.currentTarget != null) {
      descriptions.push(targetDescription(this.currentTarget))
    }
    const intercepter = ((): Creep | null => {
      const intercepterName = Array.from(Object.values(this.intercepterCreepNames))[0]
      if (intercepterName == null) {
        return null
      }
      return Game.creeps[intercepterName] ?? null
    })()
    if (intercepter != null) {
      descriptions.push(`${Array.from(Object.keys(this.intercepterCreepNames)).length} creep in ${roomLink(intercepter.room.name)}`)
    }
    return descriptions.join(", ")
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    if (this.currentTarget == null) {
      this.checkRemoteRooms()
      return
    }
    const updatedTarget = this.updatedTarget(this.currentTarget)
    if (updatedTarget === "as is") {
      // do nothing
    } else if (updatedTarget == null) {
      this.currentTarget = null
      return
    } else {
      this.currentTarget = updatedTarget
    }
    const target = this.currentTarget

    const creepMaxCount = 1
    const intercepters = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)
    Array.from(Object.entries(this.intercepterCreepNames)).forEach(([roomName, intercepterName]) => {
      const creep = Game.creeps[intercepterName]
      if (creep == null) {
        // 寿命死以外
        delete this.intercepterCreepNames[roomName]
        PrimitiveLogger.fatal(`${this.constructor.name} ${this.processId} intercepter ${intercepterName} was killed ${roomHistoryLink(roomName)}`)
      } else {
        if (creep.ticksToLive != null && creep.ticksToLive <= 1) {
          delete this.intercepterCreepNames[roomName]
        }
      }
    })
    intercepters.forEach(creep => {
      if (this.intercepterCreepNames[target.roomName] != null) {
        return
      }
      this.intercepterCreepNames[target.roomName] = creep.name
    })

    if (intercepters.length < creepMaxCount && this.intercepterCreepNames[target.roomName] == null) {
      this.spawnIntercepter(roomResource, target)
    }

    intercepters.forEach(creep => this.runIntercepter(creep, target))
  }

  private runIntercepter(creep: Creep, target: TargetInfo): void {
    const nearbyHostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, rangedAttackRange).map(hostileCreep => ({creep: hostileCreep, range: hostileCreep.pos.getRangeTo(creep)}))
    nearbyHostiles.sort((lhs, rhs) => (lhs.range - rhs.range))
    const attackTarget = nearbyHostiles[0]

    if (attackTarget != null || creep.hits < creep.hitsMax) {
      creep.heal(creep)
    }
    if (attackTarget != null) {
      if (attackTarget.range <= 1) {
        creep.rangedMassAttack()
      } else {
        creep.rangedAttack(attackTarget.creep)
      }

      if (attackTarget.range < rangedAttackRange) {
        this.flee(creep, attackTarget.creep.pos, rangedAttackRange + 1)
        return
      } else if (attackTarget.range === rangedAttackRange) {
        return
      }
    }

    if (creep.room.name !== target.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, target.roomName) ?? []
      moveToRoom(creep, target.roomName, waypoints)
      return
    }

    const targetRoomResource = RoomResources.getNormalRoomResource(creep.room.name)
    if (targetRoomResource == null) {
      const hostileCreep = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS)
      if (hostileCreep == null) {
        this.currentTarget = null
        return
      }
      creep.moveTo(hostileCreep.pos, defaultMoveToOptions())
      return
    }

    const { min, max } = GameConstants.room.edgePosition
    const haulerBodyParts: BodyPartConstant[] = [CARRY, MOVE]
    const hostileCreeps = targetRoomResource.hostiles.creeps.filter(hostileCreep => {
      const position = hostileCreep.pos
      if (creep.body.every(body => haulerBodyParts.includes(body.type) === true)) {
        return false
      }
      if (position.x <= min && position.x >= max && position.y <= min && position.y >= max) {
        return false
      }
      return true
    })
    const chaseTarget = creep.pos.findClosestByPath(hostileCreeps)
    if (chaseTarget == null) {
      if (targetRoomResource.hostiles.creeps.length <= 0) {
        this.currentTarget = null
      }
      return
    }

    creep.moveTo(chaseTarget.pos, defaultMoveToOptions())
  }

  private flee(creep: Creep, position: RoomPosition, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 1,
    })
    if (path.incomplete === true || path.path.length <= 1) {
      creep.say("no path")
    }
    creep.moveByPath(path.path)
  }

  private spawnIntercepter(roomResource: OwnedRoomResource, target: TargetInfo): void {
    const rangedAttackCount = Math.max(Math.ceil(target.totalPower.heal / GameConstants.creep.actionPower.rangedAttack), 5)
    const healCount = ((): number => {
      const count = Math.max(Math.ceil(target.totalPower.rangedAttack / GameConstants.creep.actionPower.heal), 1)
      if (count > 3) {
        return Math.ceil(count / 2) + 1
      }
      return count
    })()
    const moveCount = rangedAttackCount + healCount

    const body: BodyPartConstant[] = [
      ...Array(moveCount).fill(MOVE),
      ...Array(rangedAttackCount).fill(RANGED_ATTACK),
      ...Array(healCount).fill(HEAL),
      MOVE, MOVE,
    ]

    if (CreepBody.cost(body) > roomResource.room.energyCapacityAvailable) {
      PrimitiveLogger.fatal(`${this.constructor.name} ${this.processId} can't handle invader in ${roomLink(target.roomName)} ${targetDescription(target)}, estimated intercepter body: ${CreepBody.description(body)}`)
      return
    }

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [],
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private updatedTarget(target: TargetInfo): TargetInfo | "as is" | null {
    const targetRoomResource = RoomResources.getNormalRoomResource(target.roomName)
    if (targetRoomResource == null) {
      return "as is"
    }

    if (targetRoomResource.hostiles.creeps.length <= 0) {
      return null
    }

    if (targetRoomResource.hostiles.creeps.length !== target.hostileCreep.totalCreepCount) {
      return this.calculateTargetInfo(targetRoomResource)
    }
    return "as is"
  }

  private checkRemoteRooms(): void {
    const targets = this.targetRooms.flatMap((roomInfo): TargetInfo[] => {
      const roomResource = RoomResources.getNormalRoomResource(roomInfo.name)
      if (roomResource == null) {
        return []
      }
      if (roomResource.hostiles.creeps.length <= 0) {
        return []
      }
      const target = this.calculateTargetInfo(roomResource)
      if (target == null) {
        return []
      }
      return [target]
    })

    targets.sort((lhs, rhs) => {
      return rhs.priority - lhs.priority
    })

    const target = targets[0] ?? null
    this.currentTarget = target
  }

  private calculateTargetInfo(roomResource: NormalRoomResource): TargetInfo | null {
    const playerNames: string[] = []
    let totalAttackPower = 0
    let totalRangedAttackPower = 0
    let totalHealPower = 0
    let totalHits = 0
    let boosted = false as boolean
    let attackerCount = 0

    roomResource.hostiles.creeps.forEach(creep => {
      if (playerNames.includes(creep.owner.username) !== true) {
        playerNames.push(creep.owner.username)
      }
      const attackPower = CreepBody.power(creep.body, "attack")
      const rangedAttackPower = CreepBody.power(creep.body, "rangedAttack")
      const healPower = CreepBody.power(creep.body, "heal")

      if (attackPower <= 0 && rangedAttackPower <= 0 && healPower <= 0) {
        if (creep.getActiveBodyparts(WORK) <= 0 && creep.getActiveBodyparts(CLAIM) <= 0) {
          return
        }
      }
      attackerCount += 1

      totalAttackPower += attackPower
      totalRangedAttackPower += rangedAttackPower
      totalHealPower += healPower
      totalHits = creep.hitsMax

      if (boosted !== true && creep.body.some(body => body.boost != null)) {
        boosted = true
      }
    })

    if (attackerCount <= 0) {
      return null
    }

    const onlyNpc = playerNames.length === 1 && playerNames[0] === Invader.username
    const priority = ((): number => {
      let value = 0
      value += totalAttackPower * 0.3
      value += totalRangedAttackPower
      value += totalHealPower * 3
      return value
    })()

    return {
      roomName: roomResource.room.name,
      attacker: {
        playerNames,
        onlyNpc,
      },
      totalPower: {
        attack: totalAttackPower,
        rangedAttack: totalRangedAttackPower,
        heal: totalHealPower,
        hits: totalHits,
      },
      hostileCreep: {
        boosted,
        attackerCount,
        totalCreepCount: roomResource.hostiles.creeps.length,
      },
      priority,
    }
  }
}

function targetDescription(targetInfo: TargetInfo): string {
  const actionPowerDescription = (action: ATTACK | RANGED_ATTACK | HEAL): string => {
    switch (action) {
    case ATTACK:
      return `<b>${coloredText(`${targetInfo.totalPower.attack}`, "info")}</b>${coloredCreepBody(ATTACK)}`
    case RANGED_ATTACK:
      return `<b>${coloredText(`${targetInfo.totalPower.rangedAttack}`, "info")}</b>${coloredCreepBody(RANGED_ATTACK)}`
    case HEAL:
      return `<b>${coloredText(`${targetInfo.totalPower.heal}`, "info")}</b>${coloredCreepBody(HEAL)}`
    }
  }

  const descriptions: string[] = []
  if (targetInfo.hostileCreep.boosted === true) {
    descriptions.push(coloredText("boosted", "error"))
  }
  const actionPowers: string[] = []
  if (targetInfo.totalPower.attack > 0) {
    actionPowers.push(actionPowerDescription(ATTACK))
  }
  if (targetInfo.totalPower.rangedAttack > 0) {
    actionPowers.push(actionPowerDescription(RANGED_ATTACK))
  }
  if (targetInfo.totalPower.heal > 0) {
    actionPowers.push(actionPowerDescription(HEAL))
  }
  if (actionPowers.length > 0) {
    descriptions.push(actionPowers.join(""))
  }
  const playerDescriptions = targetInfo.attacker.playerNames.map(name => profileLink(name)).join(",")
  descriptions.push(`${targetInfo.hostileCreep.attackerCount} ${playerDescriptions} creeps`)
  descriptions.push(`in ${roomLink(targetInfo.roomName)}`)
  return descriptions.join(" ")
}

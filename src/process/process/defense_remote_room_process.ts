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
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"

ProcessDecoder.register("DefenseRemoteRoomProcess", state => {
  return DefenseRemoteRoomProcess.decode(state as DefenseRemoteRoomProcessState)
})

let errorMessages: string[] = []
const raiseError = (errorMessage: string, notify?: boolean): void => {
  if (errorMessages.includes(errorMessage) === true) {
    return
  }
  if (errorMessages.length > 100) {
    errorMessages = []
  }
  errorMessages.push(errorMessage)

  if (notify === true) {
    PrimitiveLogger.fatal(`${coloredText("[Error]", "error")} ${errorMessage}`)
  } else {
    PrimitiveLogger.log(`${coloredText("[Error]", "error")} ${errorMessage}`)
  }
}

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
  readonly currentTarget: TargetInfo | null
  readonly intercepterCreepNames: {[roomName: string]: CreepName}
}

export class DefenseRemoteRoomProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private get targetRooms(): RoomInfo[] {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return []
    }
    return Array.from(Object.entries(roomResource.roomInfo.remoteRoomInfo)).flatMap(([roomName, roomInfo]): RoomInfo[] => {
      if (roomInfo.enabled !== true) {
        return []
      }
      return [
        {
          name: roomName,
        }
      ]
    })
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private currentTarget: TargetInfo | null,
    private intercepterCreepNames: { [roomName: string]: CreepName },
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
      currentTarget: this.currentTarget,
      intercepterCreepNames: this.intercepterCreepNames,
    }
  }

  public static decode(state: DefenseRemoteRoomProcessState): DefenseRemoteRoomProcess {
    return new DefenseRemoteRoomProcess(state.l, state.i, state.roomName, state.currentTarget, state.intercepterCreepNames)
  }

  public static create(processId: ProcessId, roomName: RoomName): DefenseRemoteRoomProcess {
    return new DefenseRemoteRoomProcess(Game.time, processId, roomName, null, {})
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

  public processDescription(): string {
    const descriptions: string[] = [
      `targets: ${this.targetRooms.map(room => roomLink(room.name)).join(", ")}`,
      this.processShortDescription(),
    ]
    return descriptions.join("\n")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "status"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Available commands: ${commandList}`

      case "status": {
        const listArguments = new ListArguments(components)
        if (listArguments.has(0) === true) {
          const targetRoomName = listArguments.roomName(0, "room name").parse()
          if (this.targetRooms.some(targetRoom => targetRoom.name === targetRoomName) !== true) {
            throw `${roomLink(targetRoomName)} is not in the target list`
          }

          const targetRoomResource = RoomResources.getNormalRoomResource(targetRoomName)
          if (targetRoomResource == null) {
            return `no visual for ${roomLink(targetRoomName)}`
          }
          const targetInfo = this.calculateTargetInfo(targetRoomResource)
          if (targetInfo == null) {
            return `no targets in ${roomLink(targetRoomName)}`
          }
          return targetDescription(targetInfo)
        }
        return this.processDescription()
      }

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const targetRooms = [...this.targetRooms]

    if (this.currentTarget == null) {
      this.intercepterCreepNames = {}
      this.checkRemoteRooms(targetRooms)
      return
    }

    const currentTarget = this.currentTarget
    if (targetRooms.every(roomInfo => roomInfo.name !== currentTarget.roomName) === true) { // 手動でRemoteRoomが無効化された場合
      this.currentTarget = null
      return
    }

    const updatedTarget = this.updatedTarget(this.currentTarget)
    if (updatedTarget === "as is") {
      // do nothing
    } else if (updatedTarget == null) {
      this.intercepterCreepNames = {}
      this.currentTarget = null
      return
    } else {
      this.intercepterCreepNames = {}
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
        raiseError(`${this.constructor.name} ${this.processId} intercepter ${intercepterName} was killed ${roomHistoryLink(roomName)}`)
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

    if (attackTarget != null) {
      if (attackTarget.range <= 1) {
        creep.rangedMassAttack()
      } else {
        creep.rangedAttack(attackTarget.creep)
      }

      if (attackTarget.creep.getActiveBodyparts(ATTACK) > 0) {
        creep.heal(creep)
        if (attackTarget.range < rangedAttackRange) {
          this.flee(creep, attackTarget.creep.pos, rangedAttackRange + 1)
          return
        } else if (attackTarget.range === rangedAttackRange) {
          return
        }
      } else {  // no ATTACK
        creep.moveTo(attackTarget.creep.pos, defaultMoveToOptions())
        if (attackTarget.range > 1) {
          creep.heal(creep)
        } else {
          creep.attack(attackTarget.creep)
        }
        return
      }
    }

    if (creep.hits < creep.hitsMax) {
      creep.heal(creep)
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
    const rangedAttackCount = Math.max(Math.ceil((target.totalPower.heal + 1) / GameConstants.creep.actionPower.rangedAttack), 5)
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
      ATTACK,
      ...Array(rangedAttackCount).fill(RANGED_ATTACK),
      ...Array(healCount).fill(HEAL),
      MOVE, MOVE,
    ]

    const bodyCost = CreepBody.cost(body)
    const energyCapacity = roomResource.room.energyCapacityAvailable
    const bodyPartMaxCount = GameConstants.creep.body.bodyPartMaxCount
    if (bodyCost > energyCapacity || body.length > bodyPartMaxCount) {
      const shouldNotify = target.attacker.onlyNpc !== true
      raiseError(`${this.constructor.name} ${this.processId} ${roomLink(this.roomName)} can't handle invader in ${roomLink(target.roomName)} ${targetDescription(target)}, estimated intercepter body: ${CreepBody.description(body)}`, shouldNotify)
      return
    }

    if (target.attacker.onlyNpc !== true) { // TODO: 相手をコピーすれば良いのでは
      const rangedAttackIndex = body.indexOf(RANGED_ATTACK)
      if (rangedAttackIndex >= 0) {
        const moveIndex = 0
        const availableEnergy = energyCapacity - bodyCost
        const rangedAttackUnit = [MOVE, RANGED_ATTACK]
        const rangedAttackUnitCost = CreepBody.cost(rangedAttackUnit)
        const additionalRangedAttackMaxCount = Math.floor(Math.min((bodyPartMaxCount - body.length), Math.floor(availableEnergy / rangedAttackUnitCost)) / rangedAttackUnit.length)
        const rangedAttackIdealCount = Math.ceil((target.totalPower.heal * 2.5) / GameConstants.creep.actionPower.rangedAttack)
        const additionalRangedAttackCount = Math.min(additionalRangedAttackMaxCount, rangedAttackIdealCount)

        if (additionalRangedAttackCount > 0) {
          body.splice(rangedAttackIndex, 0, ...Array(additionalRangedAttackCount).fill(RANGED_ATTACK))
          body.splice(moveIndex, 0, ...Array(additionalRangedAttackCount).fill(MOVE))
        }
      }
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

  private checkRemoteRooms(targetRooms: RoomInfo[]): void {
    const targets = targetRooms.flatMap((roomInfo): TargetInfo[] => {
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
      const attackPower = CreepBody.power(creep.body, "attack", {ignoreHits: true})
      const rangedAttackPower = CreepBody.power(creep.body, "rangedAttack", { ignoreHits: true })
      const healPower = CreepBody.power(creep.body, "heal", { ignoreHits: true })

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

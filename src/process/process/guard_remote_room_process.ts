import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { coloredText, profileLink, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { CreepName, defaultMoveToOptions } from "prototype/creep"
import { randomDirection } from "utility/constants"
import { processLog } from "os/infrastructure/logger"
import { ProcessDecoder } from "process/process_decoder"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { GameConstants } from "utility/constants"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "os/infrastructure/console_command/utility/list_argument_parser"

ProcessDecoder.register("GuardRemoteRoomProcess", state => {
  return GuardRemoteRoomProcess.decode(state as GuardRemoteRoomProcessState)
})

const guardRemoteRoomProcessCreepType = [
  "small-ranged-attacker",
  "ranged-attacker",
  "heavy-ranged-attacker",
] as const
export type GuardRemoteRoomProcessCreepType = typeof guardRemoteRoomProcessCreepType[number]

export const isGuardRemoteRoomProcessCreepType = (obj: string): obj is GuardRemoteRoomProcessCreepType => {
  return (guardRemoteRoomProcessCreepType as (readonly string[])).includes(obj)
}

type Username = string

type IgnoreUser = {
  readonly name: Username
  readonly messages: string[] | null
}

type TalkingInfo = {
  [creepName: string]: {
    readonly username: Username,
    index: number,
    enabled: boolean,
  }
}

const rangedAttackerRole: CreepRole[] = [CreepRole.Attacker, CreepRole.Mover]
const smallRangedAttackerBody: BodyPartConstant[] = [  // RCL6
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  HEAL, HEAL,
]
const rangedAttackerBody: BodyPartConstant[] = [  // RCL7
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  HEAL, HEAL, HEAL, HEAL, HEAL,
]
const heavyRangedAttackerBody: BodyPartConstant[] = [
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL,
]

export interface GuardRemoteRoomProcessState extends ProcessState {
  /** parent room name */
  p: RoomName

  /** target room name */
  tr: RoomName

  /** waypoints */
  w: RoomName[]

  targetId: Id<AnyStructure | AnyCreep> | null
  creepType: GuardRemoteRoomProcessCreepType
  numberOfCreeps: number
  ignoreUsers: IgnoreUser[]
  talkingTo: TalkingInfo
}

export class GuardRemoteRoomProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private readonly creepRole: CreepRole[]
  private readonly creepBody: BodyPartConstant[]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private readonly creepType: GuardRemoteRoomProcessCreepType,
    private readonly numberOfCreeps: number,
    private readonly targetId: Id<AnyStructure | AnyCreep> | null,
    private readonly ignoreUsers: IgnoreUser[],
    private readonly talkingTo: TalkingInfo,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    switch (this.creepType) {
    case "small-ranged-attacker":
      this.creepRole = rangedAttackerRole
      this.creepBody = smallRangedAttackerBody
      break
    case "ranged-attacker":
      this.creepRole = rangedAttackerRole
      this.creepBody = rangedAttackerBody
      break
    case "heavy-ranged-attacker":
      this.creepRole = rangedAttackerRole
      this.creepBody = heavyRangedAttackerBody
      break
    }
  }

  public encode(): GuardRemoteRoomProcessState {
    return {
      t: "GuardRemoteRoomProcess",
      l: this.launchTime,
      i: this.processId,
      p: this.parentRoomName,
      tr: this.targetRoomName,
      w: this.waypoints,
      creepType: this.creepType,
      numberOfCreeps: this.numberOfCreeps,
      targetId: this.targetId,
      ignoreUsers: this.ignoreUsers,
      talkingTo: this.talkingTo,
    }
  }

  public static decode(state: GuardRemoteRoomProcessState): GuardRemoteRoomProcess {
    return new GuardRemoteRoomProcess(state.l, state.i, state.p, state.tr, state.w, state.creepType, state.numberOfCreeps, state.targetId, state.ignoreUsers, state.talkingTo)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], creepType: GuardRemoteRoomProcessCreepType, numberOfCreeps: number): GuardRemoteRoomProcess {
    return new GuardRemoteRoomProcess(Game.time, processId, parentRoomName, targetRoomName, waypoints, creepType, numberOfCreeps, null, [], {})
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    return `${roomLink(this.targetRoomName)} ${creepCount}/${this.numberOfCreeps}cr ${this.creepType}`
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "add_ignore_user"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "add_ignore_user":
        return this.addIgnoreUsers(components)
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  /** @throws */
  private addIgnoreUsers(args: string[]): string {
    const listArguments = new ListArguments(args)
    const username = listArguments.string(0, "username").parse()
    const messages = listArguments.stringList(1, "messages").parse()

    const existingInfoIndex = this.ignoreUsers.findIndex(user => user.name === username)
    if (existingInfoIndex >= 0) {
      this.ignoreUsers.splice(existingInfoIndex, 1)
    }
    this.ignoreUsers.push({
      name: username,
      messages,
    })

    return `set ${profileLink(username)} to ${messages.map(message => `"${message}"`).join(", ")}`
  }

  public runOnTick(): void {
    const whitelist = (Memory.gameInfo.sourceHarvestWhitelist as string[] | undefined) || []

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom != null && targetRoom.controller != null && targetRoom.controller.safeMode != null && targetRoom.controller.safeMode > 500) {
      processLog(this, `target room ${this.targetRoomName} in safemode`)
      return
    }

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)

    if (creeps[0] == null || (creeps.length < this.numberOfCreeps && creeps[0].ticksToLive != null && creeps[0].ticksToLive < 900)) {
      const shouldSendGuard = ((): boolean => {
        const objects = World.rooms.getOwnedRoomObjects(this.parentRoomName)
        if (objects == null) {
          return false
        }
        const energyAmount = (objects.activeStructures.storage?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
          + (objects.activeStructures.terminal?.store.getUsedCapacity(RESOURCE_ENERGY) ?? 0)
        if (energyAmount < 50000) {
          return false
        }
        if (targetRoom == null) {
          return true
        }
        if (targetRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).length < 2) {
          return true
        }
        if (targetRoom.storage == null) {
          return true
        }
        if (targetRoom.storage.store.getUsedCapacity(RESOURCE_ENERGY) < 50000) {
          return true
        }
        return false
      })()
      if (shouldSendGuard === true) {
        this.requestCreep()
      }
    }

    switch (this.creepType) {
    case "small-ranged-attacker":
    case "ranged-attacker":
    case "heavy-ranged-attacker":
      creeps.forEach(creep => this.runRangedAttacker(creep, whitelist))
      break
    default:
      PrimitiveLogger.programError(`${this.constructor.name} unhandled creep type ${this.creepType}`)
      break
    }
  }

  private requestCreep(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: this.creepRole,
      body: this.creepBody,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runRangedAttacker(creep: Creep, whitelist: string[]): void {
    const beforeTalkToInfo = this.talkingTo[creep.name]
    if (beforeTalkToInfo != null) {
      beforeTalkToInfo.enabled = false
    }
    const movement = this.attackNearbyHostile(creep, whitelist)
    if (creep.hits < creep.hitsMax) {
      creep.heal(creep)
    }

    if (movement.moved === true) {
      this.talk(creep)
      return
    }

    if (creep.v5task != null) {
      this.talk(creep)
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      const roomDistance = Game.map.getRoomLinearDistance(creep.room.name, this.targetRoomName)
      const waypoints: RoomName[] = roomDistance <= 1 ? [] : this.waypoints
      creep.v5task = MoveToRoomTask.create(this.targetRoomName, waypoints)
      this.talk(creep)
      return
    }

    if (movement.attackedTarget != null) {
      const attackedTarget = movement.attackedTarget
      if (attackedTarget.getActiveBodyparts(ATTACK) <= 0 && attackedTarget.pos.isRoomEdge !== true || creep.pos.isNearTo(attackedTarget.pos) !== true) {
        creep.moveTo(movement.attackedTarget)
      }
      this.talk(creep)
      return
    }

    const {moved} = this.runSingleAttacker(creep, whitelist)
    if (moved === true) {
      this.talk(creep)
      return
    }

    const isEnemyRoom = ((): boolean => {
      const controller = creep.room.controller
      if (controller == null) {
        return false
      }
      if (controller.my === true) {
        return false
      }
      const ignoreUsernames = this.ignoreUsers.map(user => user.name)
      if (controller.owner != null) {
        const username = controller.owner.username
        if (ignoreUsernames.includes(username) === true) {
          this.setTalkToUsername(creep.name, username)
          return false
        }
        if (whitelist.includes(username) === true) {
          return false
        }
        if (Game.isEnemy(controller.owner) !== true) {
          return false
        }
        return true
      }
      if (controller.reservation != null) {
        const username = controller.reservation.username
        if (ignoreUsernames.includes(username) === true) {
          this.setTalkToUsername(creep.name, username)
          return false
        }
        if (whitelist.includes(username) === true) {
          return false
        }
        if (Game.isEnemy(controller.reservation) !== true) {
          return false
        }
        return true
      }
      return false
    })()
    if (isEnemyRoom === true) {
      const roads = creep.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_ROAD } })
        .filter(road => road.pos.findInRange(FIND_HOSTILE_STRUCTURES, 0, { filter: { structureType: STRUCTURE_RAMPART } }).length <= 0)
      const road = creep.pos.findClosestByPath(roads)
      if (road != null) {
        creep.rangedAttack(road)
        creep.moveTo(road)
        this.talk(creep)
        return
      }
    }

    const damagedCreeps = creep.room.find(FIND_MY_CREEPS).filter(creep => creep.hits < creep.hitsMax)
    const damagedCreep = creep.pos.findClosestByPath(damagedCreeps)
    if (damagedCreep != null) {
      const range = creep.pos.getRangeTo(damagedCreep.pos)
      if (range <= GameConstants.creep.actionRange.heal) {
        creep.heal(damagedCreep)
      } else if (range <= GameConstants.creep.actionRange.rangedHeal) {
        creep.rangedHeal(damagedCreep)
      }
      creep.moveTo(damagedCreep)
      this.talk(creep)
      return
    }

    const waitingTarget = creep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })[0] ?? creep.room.controller
    if (waitingTarget == null) {      this.talk(creep)
      this.talk(creep)
      return
    }
    const waitingRange = 5
    if (creep.pos.getRangeTo(waitingTarget.pos) <= waitingRange) {
      if (creep.pos.findInRange(FIND_MY_CREEPS, 1).length > 1) {  // 自身を含むため>1
        creep.move(randomDirection(this.launchTime))
      }
      this.talk(creep)
      return
    }
    const moveToOptions = defaultMoveToOptions()
    moveToOptions.range = waitingRange
    creep.moveTo(waitingTarget, moveToOptions)
    this.talk(creep)
  }

  private runSingleAttacker(creep: Creep, whitelist: string[]): { moved: boolean} {
    const target = this.getClosestHostile(creep, creep.room.find(FIND_HOSTILE_CREEPS), whitelist)
    if (target == null) {
      return {moved: false}
    }

    this.rangedAttack(creep, target)
    if (target.getActiveBodyparts(ATTACK) > 0 && target.pos.getRangeTo(creep.pos) <= 2) {
      this.fleeFrom(target.pos, creep, 4)
    } else {
      if (target.pos.isRoomEdge !== true || creep.pos.isNearTo(target.pos) !== true) {
        creep.moveTo(target)
      }
    }
    return { moved: true}
  }

  private attackNearbyHostile(creep: Creep, whitelist: string[]): { attackedTarget: Creep | null, moved: boolean } {
    let attackedTarget = null as Creep | null
    let moved = false
    const closestHostile = this.closestHostile(creep, whitelist)
    if (closestHostile != null) {
      this.rangedAttack(creep, closestHostile)
      attackedTarget = closestHostile

      if (closestHostile.getActiveBodyparts(ATTACK) > 0 && closestHostile.pos.getRangeTo(creep) <= 2) {
        this.fleeFrom(closestHostile.pos, creep, 4)
        moved = true
      }
    }
    return { attackedTarget, moved }
  }

  private closestHostile(creep: Creep, whitelist: string[]): Creep | null {
    return this.getClosestHostile(creep, creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4), whitelist)
  }

  private getClosestHostile(creep: Creep, hostileCreeps: Creep[], whitelist: string[]): Creep | null {
    const ignoreUsernames = this.ignoreUsers.map(user => user.name)
    const filteredCreeps = hostileCreeps.filter(creep => {
      const username = creep.owner.username
      if (ignoreUsernames.includes(username) === true) {
        this.setTalkToUsername(creep.name, username)
        return false
      }
      if (whitelist.includes(username) === true) {
        return false
      }
      return true
    })

    return creep.pos.findClosestByPath(filteredCreeps) ?? null
  }

  private rangedAttack(creep: Creep, target: AnyCreep | AnyStructure): void {
    if (creep.pos.isNearTo(target.pos) === true) {
      creep.rangedMassAttack()
    } else {
      creep.rangedAttack(target)
    }
  }

  private fleeFrom(position: RoomPosition, creep: Creep, range: number): void {
    const path = PathFinder.search(creep.pos, { pos: position, range }, {
      flee: true,
      maxRooms: 1,
    })
    creep.moveByPath(path.path)
  }

  private setTalkToUsername(creepName: CreepName, username: Username): void {
    const talkingTo = this.talkingTo[creepName]
    if (talkingTo == null) {
      this.talkingTo[creepName] = {
        username,
        index: 0,
        enabled: true,
      }
      return
    }

    if (talkingTo.username === username) {
      talkingTo.enabled = true
      return
    }
    this.talkingTo[creepName] = {
      username,
      index: 0,
      enabled: true,
    }
  }

  private talk(creep: Creep): void {
    const talkingTo = this.talkingTo[creep.name]
    if (talkingTo == null || talkingTo.enabled !== true) {
      return
    }

    const username = talkingTo.username
    const talk = this.ignoreUsers.find(user => user.name === username)
    if (talk == null || talk.messages == null || talk.messages.length <= 0) {
      return
    }

    talkingTo.index = (talkingTo.index + 1) % talk.messages.length
    const message = talk.messages[talkingTo.index]
    if (message == null) {
      return
    }
    creep.say(message, true)
  }
}

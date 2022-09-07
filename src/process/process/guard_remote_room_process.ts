import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
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
import { GameConstants } from "utility/constants"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { RoomResources } from "room_resource/room_resources"
import { Timestamp } from "shared/utility/timestamp"
import { Position } from "prototype/room_position"
import { ArgumentParser } from "shared/utility/argument_parser/argument_parser"

ProcessDecoder.register("GuardRemoteRoomProcess", state => {
  return GuardRemoteRoomProcess.decode(state as GuardRemoteRoomProcessState)
})

const guardRemoteRoomProcessCreepType = [
  "small-ranged-attacker",       // RCL6
  "ranged-attacker",             // RCL7
  "high-speed-ranged-attacker",  // RCL8
  "heavy-ranged-attacker",       // RCL8
] as const
export type GuardRemoteRoomProcessCreepType = typeof guardRemoteRoomProcessCreepType[number]

export const isGuardRemoteRoomProcessCreepType = (obj: string): obj is GuardRemoteRoomProcessCreepType => {
  return (guardRemoteRoomProcessCreepType as (readonly string[])).includes(obj)
}

const finishConditionCases = [
  "never",
  "duration",
  "owned_room",
  "unclaimed",
] as const

type FinishConditionNever = {
  readonly case: "never"
}
type FinishConditionDuration = {
  readonly case: "duration"
  readonly until: Timestamp
}
type FinishConditionOwnedRoom = {
  readonly case: "owned_room"
  readonly condition: "tower" | "2towers" | "storage"
}
type FinishConditionUnclaimed = {
  readonly case: "unclaimed"
}
type FinishCondition = FinishConditionNever | FinishConditionDuration | FinishConditionOwnedRoom | FinishConditionUnclaimed

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
const smallRangedAttackerBody: BodyPartConstant[] = [
  TOUGH,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  HEAL, HEAL,
  MOVE,
]
const rangedAttackerBody: BodyPartConstant[] = [
  TOUGH, TOUGH,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  MOVE,
]
const highSpeedangedAttackerBody: BodyPartConstant[] = [
  TOUGH, TOUGH,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  MOVE,
]
const heavyRangedAttackerBody: BodyPartConstant[] = [
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE, MOVE,
  MOVE, MOVE, MOVE, MOVE,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  RANGED_ATTACK, RANGED_ATTACK, RANGED_ATTACK,
  HEAL, HEAL, HEAL, HEAL, HEAL,
  HEAL, HEAL, HEAL, HEAL,
  MOVE,
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
  finishCondition: FinishCondition
  safemodeCooldown: number
  stopSpawningReasons: string[]
  waitingPosition: Position | null
}

export class GuardRemoteRoomProcess implements Process, Procedural, MessageObserver {
  public get taskIdentifier(): string {
    return this.identifier
  }

  public readonly identifier: string
  private readonly codename: string

  private creepRole: CreepRole[]
  private creepBody: BodyPartConstant[]

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    public readonly targetRoomName: RoomName,
    public readonly waypoints: RoomName[],
    private creepType: GuardRemoteRoomProcessCreepType,
    private numberOfCreeps: number,
    private readonly targetId: Id<AnyStructure | AnyCreep> | null,
    private readonly ignoreUsers: IgnoreUser[],
    private talkingTo: TalkingInfo,
    private safemodeCooldown: number,
    private finishCondition: FinishCondition,
    private stopSpawningReasons: string[],
    private waitingPosition: Position | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}_${this.parentRoomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    const { roles, body } = creepSpecFor(creepType)
    this.creepRole = roles
    this.creepBody = body
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
      safemodeCooldown: this.safemodeCooldown,
      finishCondition: this.finishCondition,
      stopSpawningReasons: this.stopSpawningReasons,
      waitingPosition: this.waitingPosition,
    }
  }

  public static decode(state: GuardRemoteRoomProcessState): GuardRemoteRoomProcess {
    return new GuardRemoteRoomProcess(
      state.l,
      state.i,
      state.p,
      state.tr,
      state.w,
      state.creepType,
      state.numberOfCreeps,
      state.targetId,
      state.ignoreUsers,
      state.talkingTo,
      state.safemodeCooldown,
      state.finishCondition,
      state.stopSpawningReasons,
      state.waitingPosition,
    )
  }

  public static create(processId: ProcessId, parentRoomName: RoomName, targetRoomName: RoomName, waypoints: RoomName[], creepType: GuardRemoteRoomProcessCreepType, numberOfCreeps: number): GuardRemoteRoomProcess {
    const defaultFinishCondition: FinishConditionNever = {
      case: "never"
    }
    return new GuardRemoteRoomProcess(
      Game.time,
      processId,
      parentRoomName,
      targetRoomName,
      waypoints,
      creepType,
      numberOfCreeps,
      null,
      [],
      {},
      500,
      defaultFinishCondition,
      [],
      null,
    )
  }

  public processShortDescription(): string {
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier, () => true)
    const descriptions: string[] = [
      roomLink(this.targetRoomName),
      `${creepCount}/${this.numberOfCreeps}cr`,
      this.creepType,
    ]

    if (this.stopSpawningReasons.length > 0) {
      descriptions.push(`stopped by: ${this.stopSpawningReasons.join(", ")}`)
    }
    return descriptions.join(" ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "add_ignore_user", "set_creep_count", "change_creep_type", "change_finish_condition", "change_safemode_cooldown", "waiting_position", "resume", "stop"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "add_ignore_user":
        return this.addIgnoreUsers(components)
      case "set_creep_count":
        return this.setCreepCount(components)
      case "change_creep_type":
        return this.changeCreepType(components)
      case "change_finish_condition":
        return this.changeFinishCondition(components)
      case "change_safemode_cooldown":
        return this.changeSafemodeCooldown(components)
      case "waiting_position":
        return this.setWaitingPosition(components)
      case "resume":
        this.stopSpawningReasons = []
        return "ok"
      case "stop":
        this.addStopSpawningReason("manually")
        return "ok"
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  /** @throws */
  private setWaitingPosition(args: string[]): string {
    const listArguments = new ListArguments(args)
    const command = listArguments.string(0, "command").parse()

    switch (command) {
    case "set":
      this.waitingPosition = listArguments.localPosition(1, "position").parse()
      return "ok"

    case "remove":
      this.waitingPosition = null
      return "ok"

    default:
      throw `invalid command ${command}, available commands: set, remove`
    }
  }

  /** @throws */
  private setCreepCount(args: string[]): string {
    const listArguments = new ListArguments(args)
    const creepCount = listArguments.int(0, "creep count").parse({ min: 1, max: 10 })
    const oldValue = this.numberOfCreeps
    this.numberOfCreeps = creepCount

    return `set ${this.numberOfCreeps} (from: ${oldValue})`
  }

  /** @throws */
  private changeSafemodeCooldown(args: string[]): string {
    const listArguments = new ListArguments(args)
    const cooldown = listArguments.int(0, "safemode cooldown").parse({ min: 0 })
    const oldValue = this.safemodeCooldown
    this.safemodeCooldown = cooldown

    return `set ${this.safemodeCooldown} (from: ${oldValue})`
  }

  /** @throws */
  private changeFinishCondition(args: string[]): string {
    const parser = new ArgumentParser(args)
    const keywordArguments = parser.keyword

    const command = parser.list.string(0, "command").parse()
    if (command === "help") {
      return `finish conditions: ${finishConditionCases.join(", ")}`
    }

    const conditionType = keywordArguments.string("condition").parse()

    const condition = ((): FinishCondition => {
      switch (conditionType) {
      case "duration": {
        const duration = keywordArguments.int("duration").parse({ min: 1000 })
        return {
          case: "duration",
          until: Game.time + duration
        }
      }

      case "owned_room": {
        const roomCondition = keywordArguments.string("room_condition").parse()
        if (roomCondition !== "tower" && roomCondition !== "storage" && roomCondition !== "2towers") {
          throw `room_condition can either "tower", "2towers" or "storage" (${roomCondition})`
        }
        return {
          case: "owned_room",
          condition: roomCondition,
        }
      }

      case "unclaimed": {
        return {
          case: "unclaimed",
        }
      }

      case "never":
        return {
          case: "never"
        }

      default:
        throw `invalid condition ${conditionType}, available conditions: ${finishConditionCases}`
      }
    })()

    const oldValue = this.finishCondition
    this.finishCondition = condition
    return `changed condition: ${conditionType} from ${oldValue.case}`
  }

  /** @throws */
  private changeCreepType(args: string[]): string {
    const listArguments = new ListArguments(args)
    const creepType = listArguments.typedString(0, "creep type", "GuardRemoteRoomProcessCreepType", isGuardRemoteRoomProcessCreepType).parse()
    if (creepType === this.creepType) {
      throw `creep type ${creepType} already set`
    }

    const oldValue = this.creepType
    this.creepType = creepType

    const { roles, body } = creepSpecFor(creepType)
    this.creepRole = roles
    this.creepBody = body

    return `changed creep type ${creepType} from ${oldValue}`
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
    if ((Game.time % 1511) === 27) {
      this.talkingTo = {}
    }

    const sourceHarvestWhitelist = (Memory.gameInfo.sourceHarvestWhitelist as string[] | undefined) || []
    const whitelist: string[] = [
      ...Memory.gameInfo.whitelist,
      ...sourceHarvestWhitelist,
    ]

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom != null && targetRoom.controller != null && targetRoom.controller.safeMode != null && targetRoom.controller.safeMode > this.safemodeCooldown) {
      processLog(this, `target room ${this.targetRoomName} in safemode`)
      return
    }

    const creeps = World.resourcePools.getCreeps(this.parentRoomName, this.identifier, () => true)
    const shouldSpawn = ((): boolean => {
      if (this.stopSpawningReasons.length > 0) {
        return false
      }
      if (this.numberOfCreeps === 1) {
        const dyingCreepCount = creeps.filter(creep => {
          if (creep.ticksToLive == null) {
            return false
          }
          if (creep.ticksToLive > 300) {
            return false
          }
          return true
        }).length

        if ((creeps.length - dyingCreepCount) < this.numberOfCreeps) {
          return true
        }
        return false
      }

      if (creeps.length < (this.numberOfCreeps - 1)) {
        return true
      }
      // numberOfCreepsが2以上の場合、spawnのタイミングをずらす
      if (this.numberOfCreeps === 2 && creeps.length === 1 && creeps[0] != null) {
        const ticksToLive = creeps[0].ticksToLive
        if (ticksToLive != null && ticksToLive > (GameConstants.creep.life.lifeTime - 300)) {
          return false
        }
      }
      const isSpawning = creeps.some(creep => creep.spawning === true)
      if (isSpawning !== true && creeps.length < this.numberOfCreeps) {
        return true
      }
      return false
    })()

    if (shouldSpawn === true) {
      this.requestCreep()
    }

    if (this.stopSpawningReasons.length <= 0) {
      this.checkFinishCondition()
    }

    switch (this.creepType) {
    case "small-ranged-attacker":
    case "ranged-attacker":
    case "high-speed-ranged-attacker":
    case "heavy-ranged-attacker":
      creeps.forEach(creep => this.runRangedAttacker(creep, whitelist))
      break
    }
  }

  private checkFinishCondition(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResource == null) {
      return
    }
    const energyAmount = roomResource.getResourceAmount(RESOURCE_ENERGY)
    if (energyAmount < 50000) {
      return
    }

    const targetRoom = Game.rooms[this.targetRoomName]
    if (targetRoom == null) {
      return
    }

    if (targetRoom.controller != null && targetRoom.controller.safeMode != null) {
      this.addStopSpawningReason("target room is safemode")
      return
    }

    switch (this.finishCondition.case) {
    case "owned_room":
      ((): void => {
        switch (this.finishCondition.condition) {
        case "tower":
          if (targetRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).length > 0) {
            this.addStopSpawningReason("owned room tower")
          }
          return
        case "2towers":
          if (targetRoom.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER } }).length >= 2) {
            this.addStopSpawningReason("owned room 2 towers")
          }
          return
        case "storage":
          if (targetRoom.storage != null) {
            this.addStopSpawningReason("owned room storage")
          }
          return
        }
      })()
      return

    case "duration":
      if (Game.time >= this.finishCondition.until) {
        this.addStopSpawningReason("duration ended")
      }
      return
    case "unclaimed":
      if (targetRoom.controller == null) {
        this.addStopSpawningReason("not claimed")
        return
      }
      if (targetRoom.controller.owner != null) {
        if (targetRoom.controller.my === true) {
          this.addStopSpawningReason("target owned")
          return
        }
        return
      }
      if (targetRoom.controller.reservation != null) {
        if (targetRoom.controller.reservation.username === Game.user.name) {
          this.addStopSpawningReason("target reserved")
          return
        }
        return
      }
      this.addStopSpawningReason("target unclaimed")
      return
    case "never":
      return
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.finishCondition
      return
    }
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

    const waitingPosition = ((): Position | null => {
      if (this.waitingPosition != null) {
        return this.waitingPosition
      }

      const spawn = creep.room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_SPAWN } })[0]
      if (spawn != null) {
        return spawn.pos
      }
      return creep.room.controller?.pos ?? null
    })()
    if (waitingPosition == null) {
      this.talk(creep)
      return
    }
    const waitingRange = 5
    if (creep.pos.getRangeTo(waitingPosition.x, waitingPosition.y) <= waitingRange) {
      if (creep.pos.findInRange(FIND_MY_CREEPS, 1).length > 1) {  // 自身を含むため>1
        creep.move(randomDirection(this.launchTime))
      }
      this.talk(creep)
      return
    }
    const moveToOptions = defaultMoveToOptions()
    moveToOptions.range = waitingRange
    creep.moveTo(waitingPosition.x, waitingPosition.y, moveToOptions)
    this.talk(creep)
  }

  private runSingleAttacker(creep: Creep, whitelist: string[]): { moved: boolean} {
    const target = this.getClosestHostile(creep, creep.room.find(FIND_HOSTILE_CREEPS), whitelist)
    if (target == null) {
      return {moved: false}
    }

    this.rangedAttack(creep, target)
    if (target.getActiveBodyparts(ATTACK) > 0) {
      const range = target.pos.getRangeTo(creep.pos)
      if (range <= 2) {
        this.fleeFrom(target.pos, creep, 4)
      } else if (range === 3) {
        // do nothing
      } else {
        creep.moveTo(target)
      }
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

      const hasAttackPart = closestHostile.getActiveBodyparts(ATTACK) > 0
      const shouldFlee = ((): boolean => {
        if ((creep.hitsMax - creep.hits) < 300) {
          return false
        }

        if (hasAttackPart !== true && closestHostile.getActiveBodyparts(RANGED_ATTACK) <= 5) {
          return false
        }

        const minimumMoveCount = ((): number => {
          const totalBodyCount = creep.body.length
          return Math.ceil(totalBodyCount / 3)
        })()

        return (creep.getActiveBodyparts(MOVE) - 6) < minimumMoveCount
      })()

      if (shouldFlee === true) {
        creep.say("flee")
        this.fleeFrom(closestHostile.pos, creep, 8)
        moved = true
      } else {
        const range = closestHostile.pos.getRangeTo(creep)
        if (hasAttackPart === true) {
          if (range <= 2) {
            this.fleeFrom(closestHostile.pos, creep, 4)
          } else if (range === 3) {
            // do nothing
          } else {
            creep.moveTo(closestHostile)
          }
        } else {
          creep.moveTo(closestHostile)
        }
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
    const filteredCreeps = hostileCreeps.filter(hostileCreep => {
      const username = hostileCreep.owner.username
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
    if (message == null || message.length <= 0) {
      return
    }
    creep.say(message, true)
  }

  private addStopSpawningReason(reason: string): void {
    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
  }
}

function creepSpecFor(creepType: GuardRemoteRoomProcessCreepType): { roles: CreepRole[], body: BodyPartConstant[] } {
  switch (creepType) {
  case "small-ranged-attacker":
    return {
      roles: rangedAttackerRole,
      body: smallRangedAttackerBody,
    }
  case "ranged-attacker":
    return {
      roles: rangedAttackerRole,
      body: rangedAttackerBody,
    }
  case "high-speed-ranged-attacker":
    return {
      roles: rangedAttackerRole,
      body: highSpeedangedAttackerBody,
    }
  case "heavy-ranged-attacker":
    return {
      roles: rangedAttackerRole,
      body: heavyRangedAttackerBody,
    }
  }
}

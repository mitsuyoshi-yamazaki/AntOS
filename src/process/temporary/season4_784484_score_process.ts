import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import type { RoomName } from "shared/utility/room_name_types"
import { CreepName, defaultMoveToOptions } from "prototype/creep"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { World } from "world_info/world_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { GameMap } from "game/game_map"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { directionDescription, GameConstants } from "utility/constants"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepBody } from "utility/creep_body"
import { OperatingSystem } from "os/os"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { Timestamp } from "shared/utility/timestamp"
import { Position } from "prototype/room_position"
import { MessageObserver } from "os/infrastructure/message_observer"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { ResourceManager } from "utility/resource_manager"

ProcessDecoder.register("Season4784484ScoreProcess", state => {
  return Season4784484ScoreProcess.decode(state as Season4784484ScoreProcessState)
})

type HighwayDirection = TOP | BOTTOM | LEFT | RIGHT
type ScoreProcessState = "running" | "fallback"

const haulerRoles: CreepRole[] = [CreepRole.Hauler]

interface Season4784484ScoreProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly highwayEntranceRoomName: RoomName

  /// highwayEntranceRoomNameから向かう方向
  readonly direction: HighwayDirection
  readonly commodityType: CommodityConstant
  readonly amount: number
  readonly scoutName: CreepName | null
  readonly haulerName: CreepName | null
  readonly convoyCreepInfo: {
    readonly creepId: Id<Creep>
    readonly estimatedDespawnTime: Timestamp
    readonly lastLocation: {
      readonly observedAt: Timestamp
      readonly position: Position
      readonly roomName: RoomName
      readonly encounted: boolean
    } | null
  }
  readonly processState: ScoreProcessState
  readonly options: {
    readonly dryRun: boolean
  }
}

/**
 * - fallback
 * - 得点されていた場合
 * - Convoyが入れ違いになったことを検出する
 *   - IDを記憶しておき、room eventのexitを見る
 */
export class Season4784484ScoreProcess implements Process, Procedural, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly highwayEntranceRoomName: RoomName,
    private direction: HighwayDirection,
    private readonly commodityType: CommodityConstant,
    private readonly amount: number,
    private scoutName: CreepName | null,
    private haulerName: CreepName | null,
    readonly convoyCreepInfo: {
      creepId: Id<Creep>
      readonly estimatedDespawnTime: Timestamp,
      lastLocation: {
        readonly observedAt: Timestamp
        readonly position: Position
        readonly roomName: RoomName
        readonly encounted: boolean
      } | null
    },
    private processState: ScoreProcessState,
    private readonly options: {
      readonly dryRun: boolean
    },
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}_${this.roomName}_${this.commodityType}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season4784484ScoreProcessState {
    return {
      t: "Season4784484ScoreProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      highwayEntranceRoomName: this.highwayEntranceRoomName,
      direction: this.direction,
      commodityType: this.commodityType,
      amount: this.amount,
      scoutName: this.scoutName,
      haulerName: this.haulerName,
      convoyCreepInfo: this.convoyCreepInfo,
      processState: this.processState,
      options: this.options,
    }
  }

  public static decode(state: Season4784484ScoreProcessState): Season4784484ScoreProcess {
    return new Season4784484ScoreProcess(
      state.l,
      state.i,
      state.roomName,
      state.highwayEntranceRoomName,
      state.direction,
      state.commodityType,
      state.amount,
      state.scoutName,
      state.haulerName,
      state.convoyCreepInfo,
      state.processState,
      state.options,
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, highwayEntranceRoomName: RoomName, direction: HighwayDirection, commodityType: CommodityConstant, amount: number, convoyCreepId: Id<Creep>, estimatedDespawnTime: Timestamp, options?: { dryRun?: boolean }): Season4784484ScoreProcess {
    const convoyCreepInfo = {
      creepId: convoyCreepId,
      estimatedDespawnTime: Game.time + estimatedDespawnTime,
      lastLocation: null,
    }
    const fixTypedOptions = {
      dryRun: options?.dryRun ?? false,
    }
    const processState: ScoreProcessState = "running"
    return new Season4784484ScoreProcess(Game.time, processId, roomName, highwayEntranceRoomName, direction, commodityType, amount, null, null, convoyCreepInfo, processState, fixTypedOptions)
  }

  public processShortDescription(): string {
    const dryRun = this.options.dryRun === true ? "[Dry run] " : ""

    const haulerDescription = ((): string => {
      if (this.haulerName == null) {
        return `${dryRun}no creep`
      }
      const hauler = Game.creeps[this.haulerName]
      if (hauler == null) {
        return `${dryRun}finished`
      }
      return `${dryRun}hauler in ${hauler.pos}`
    })()
    return `${dryRun}${roomLink(this.roomName)} ${coloredResourceType(this.commodityType)} ${haulerDescription}, convoy ID: ${this.convoyCreepInfo.creepId}`
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "fallback", "set"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "fallback": {
        const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
        if (roomResource == null) {
          throw `no room resource ${roomLink(this.roomName)}`
        }
        if (roomResource.activeStructures.terminal == null) {
          throw `no terminal in ${roomLink(this.roomName)}`
        }
        const hauler = ((): Creep | null => {
          if (this.haulerName == null) {
            return null
          }
          return Game.creeps[this.haulerName] ?? null
        })()
        if (hauler == null) {
          throw `no hauler (name: ${this.haulerName})`
        }
        this.fallback(hauler, roomResource.activeStructures.terminal, "manually")
        return "fallback"
      }

      case "set":
        return this.setArgument(components)

      default:
        throw `Invalid command ${commandList}. see "help"`
      }
    } catch (error) {
      return `${coloredText("[ERROR]", "error")} ${error}`
    }
  }

  /** @throws */
  private setArgument(args: string[]): string {
    const listArguments = new ListArguments(args)
    const argumentName = listArguments.string(0, "argument").parse()

    switch (argumentName) {
    case "convoy_creep_id": {
      const convoyCreepId = listArguments.gameObjectId(1, "convoy creep id").parse() as Id<Creep>
      this.convoyCreepInfo.creepId = convoyCreepId
      return "set"
    }

    default:
      throw `invalid argument ${argumentName}, set "convoy_creep_id"`
    }
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const hauler = ((): Creep | null => {
      if (this.haulerName == null) {
        return null
      }
      return Game.creeps[this.haulerName] ?? null
    })()

    if (hauler == null) {
      if (this.haulerName != null) {
        OperatingSystem.os.killProcess(this.processId)
        return
      }

      const allCreeps = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)
      for (const creep of allCreeps) {
        if (hasNecessaryRoles(creep, haulerRoles) === true) {
          this.haulerName = creep.name
          return
        }
      }

      this.spawnHauler(roomResource)
      return
    }

    const terminal = roomResource.activeStructures.terminal
    if (terminal != null) {
      this.runHauler(hauler, terminal)
    }
  }

  private spawnHauler(roomResource: OwnedRoomResource): void {
    const requiredCarryCount = Math.ceil(this.amount / GameConstants.creep.actionPower.carryCapacity)
    const armorCount = Math.ceil(requiredCarryCount / 3)
    const body = ((): BodyPartConstant[] => {
      if (this.options.dryRun === true) {
        return [MOVE, CARRY, MOVE]
      }
      return [
        ...Array(armorCount).fill(MOVE),
        ...Array(requiredCarryCount).fill(CARRY),
        ...Array(requiredCarryCount).fill(MOVE),
      ]
    })()

    if (CreepBody.cost(body) > roomResource.room.energyCapacityAvailable) {
      PrimitiveLogger.programError(`${this.taskIdentifier} energy capacity insufficient (required: ${CreepBody.cost(body)} &gt ${roomResource.room.energyCapacityAvailable})`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }
    if (body.length > GameConstants.creep.body.bodyPartMaxCount) {
      PrimitiveLogger.programError(`${this.taskIdentifier} body too large (${body.length})`)
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: haulerRoles,
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runHauler(creep: Creep, terminal: StructureTerminal): void {
    if (this.options.dryRun === true) {
      creep.say("debugging", true)
    }

    if (this.processState !== "fallback" && creep.room.name !== this.roomName) {
      const attackerInRoom = creep.room.find(FIND_HOSTILE_CREEPS).filter(hostileCreep =>
        hostileCreep.getActiveBodyparts(ATTACK) > 0 || hostileCreep.getActiveBodyparts(RANGED_ATTACK) > 0
      ).length > 0
      if (attackerInRoom === true) {
        this.fallback(creep, terminal, "enemy presence")
        return
      }
    }

    if (creep.v5task != null) {
      // TODO: convoyがいたらタスクをキルする
      // TODO: 攻撃Creepがいたらfallbackする
      return
    }

    if (this.processState === "fallback") {
      this.fallback(creep, terminal, "program bug")
      return
    }

    const { resourceType, amount } = this.getResourceType()

    const dying = creep.ticksToLive != null && creep.ticksToLive < (GameConstants.creep.life.lifeTime - 600)

    if (creep.room.name === this.roomName) {
      if (creep.store.getUsedCapacity(resourceType) <= 0) {
        if (dying === true) {
          creep.v5task = RunApiTask.create(SuicideApiWrapper.create())
          return
        }

        const amountInTerminal = terminal.store.getUsedCapacity(resourceType)
        if (amountInTerminal >= amount) {
          creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, resourceType, amount)))
          return
        }

        const totalResourceAmount = ResourceManager.amount(resourceType)
        if (totalResourceAmount < amount) {
          creep.say("no res1")
          return
        }
        const collectAmount = Math.max(totalResourceAmount - amountInTerminal, amount, 0)
        if (collectAmount <= 0) {
          creep.say("no res2")
          return
        }

        const withdrawAmount = ((): number => {
          const collectResult = ResourceManager.collect(resourceType, this.roomName, collectAmount)
          switch (collectResult.resultType) {
          case "succeeded":
            return collectResult.value

          case "failed":
            return collectResult.reason.sentAmount
          }
        })()
        if (withdrawAmount <= 0) {
          creep.say("no res3")
          return
        }

        creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, resourceType, withdrawAmount)))
        return
      }

      const waypoints = GameMap.getWaypoints(this.roomName, this.highwayEntranceRoomName) ?? []
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.highwayEntranceRoomName, waypoints))
      return
    }

    if (creep.store.getUsedCapacity(resourceType) <= 0) {
      creep.say("done", true)
      if (creep.store.getUsedCapacity() <= 0) {
        creep.v5task = RunApiTask.create(SuicideApiWrapper.create())
      }
      return
    }

    const convoyCreep = this.findConvoyCreep()

    if (this.convoyCreepInfo.lastLocation != null) {
      const lastLocation = this.convoyCreepInfo.lastLocation
      const inDifferentRoom = convoyCreep == null || convoyCreep.room.name !== creep.room.name

      if (lastLocation.encounted === true && inDifferentRoom === true) {
        if (lastLocation != null) {
          if (lastLocation.roomName === creep.room.name) {
            const convoyDirection = ((): HighwayDirection | null => {
              const lastPosition = lastLocation.position
              const min = GameConstants.room.edgePosition.min + 1
              const max = GameConstants.room.edgePosition.max - 1
              if (lastPosition.x <= min) {
                return LEFT
              }
              if (lastPosition.x >= max) {
                return RIGHT
              }
              if (lastPosition.y <= min) {
                return TOP
              }
              if (lastPosition.y >= max) {
                return BOTTOM
              }
              return null
            })()

            if (convoyDirection != null && this.direction !== convoyDirection) {
              const oldValue = this.direction
              this.direction = convoyDirection
              PrimitiveLogger.log(`${coloredText("[Info]", "info")} ${this.taskIdentifier} ${this.processId} changed direction ${directionDescription(convoyDirection)} from ${directionDescription(oldValue)}`)
            }
          }
        }
      }
    }

    if (convoyCreep == null) {
      if (dying === true) {
        this.fallback(creep, terminal, "creep dying")
      }

      const nextRoomName = this.nextRoomName(creep.room)
      this.moveToNextRoom(creep, nextRoomName)
      return
    }

    const encounted = convoyCreep.room.name === creep.room.name
    this.convoyCreepInfo.lastLocation = {
      observedAt: Game.time,
      position: { x: convoyCreep.pos.x, y: convoyCreep.pos.y },
      roomName: convoyCreep.room.name,
      encounted,
    }

    const transferResult = creep.transfer(convoyCreep, resourceType)
    switch (transferResult) {
    case OK:
      break

    case ERR_NOT_IN_RANGE:
      creep.moveTo(convoyCreep, defaultMoveToOptions())
      break

    case ERR_FULL:
      PrimitiveLogger.fatal(`${this.taskIdentifier} ${this.processId} convoy ${this.convoyCreepInfo.creepId} is full ${creep.name} ${creep.pos}`)
      this.fallback(creep, terminal, "convoy full")
      break

    case ERR_NOT_OWNER:
    case ERR_BUSY:
    case ERR_NOT_ENOUGH_RESOURCES:
    case ERR_INVALID_TARGET:
    case ERR_INVALID_ARGS:
      PrimitiveLogger.fatal(`${this.taskIdentifier} ${this.processId} creep.transfer() returns ${transferResult} ${creep.name} ${creep.pos}`)
      this.fallback(creep, terminal, "transfer failed")
      break
    }
  }

  private getResourceType(): { resourceType: ResourceConstant, amount: number } {
    if (this.options.dryRun === true) {
      return {
        resourceType: RESOURCE_ENERGY,
        amount: 1,
      }
    }
    return {
      resourceType: this.commodityType,
      amount: this.amount,
    }
  }

  private fallback(creep: Creep, terminal: StructureTerminal, reason: string): void {
    PrimitiveLogger.log(`${coloredText("[Warning]", "warn")} ${this.taskIdentifier} ${this.processId} ${creep.name} ${creep.pos} fallback: ${reason}`)

    this.processState = "fallback"
    const { resourceType } = this.getResourceType()

    creep.say("back to room")
    const waypoints: RoomName[] = [
      this.highwayEntranceRoomName,
      ...(GameMap.getWaypoints(this.highwayEntranceRoomName, this.roomName) ?? []),
    ]
    const tasks: CreepTask[] = [
      MoveToRoomTask.create(this.roomName, waypoints),
      MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, resourceType)),
      RunApiTask.create(SuicideApiWrapper.create()),
    ]
    creep.v5task = FleeFromAttackerTask.create(SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false }))
    return
  }

  private findConvoyCreep(): Creep | null {
    return Game.getObjectById(this.convoyCreepInfo.creepId) ?? null
  }

  private nextRoomName(room: Room): RoomName {
    const roomCoordinate = room.coordinate
    return roomCoordinate.neighbourRoom(this.direction)
  }

  private moveToNextRoom(creep: Creep, nextRoomName: RoomName): void {
    const exitPosition = ((): RoomPosition | null => {
      const exit = creep.room.findExitTo(nextRoomName)
      if (exit === ERR_NO_PATH) {
        PrimitiveLogger.fatal(`${this.constructor.name} ${this.processId} creep findExitTo() returns ERR_NO_PATH, from ${roomLink(creep.room.name)} to ${roomLink(nextRoomName)}`)
        return null
      } else if (exit === ERR_INVALID_ARGS) {
        PrimitiveLogger.fatal(`${this.constructor.name} ${this.processId} Room.findExitTo() returns ERR_INVALID_ARGS (${exit}), room ${roomLink(creep.room.name)} to ${roomLink(nextRoomName)}`)
        return null
      }

      return creep.pos.findClosestByPath(exit)
    })()

    if (exitPosition == null) {
      creep.say("no exit")
      return
    }

    const directionDescription = ((): string => {
      switch (this.direction) {
      case TOP:
        return "north"
      case BOTTOM:
        return "south"
      case RIGHT:
        return "east"
      case LEFT:
        return "west"
      }
    })()
    creep.say(`go ${directionDescription}`)
    creep.moveTo(exitPosition, defaultMoveToOptions())
  }
}

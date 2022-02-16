import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import { RoomName } from "utility/room_name"
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
import { GameConstants } from "utility/constants"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepBody } from "utility/creep_body"
import { OperatingSystem } from "os/os"

ProcessDecoder.register("Season4784484ScoreProcess", state => {
  return Season4784484ScoreProcess.decode(state as Season4784484ScoreProcessState)
})

type HighwayDirection = TOP | BOTTOM | LEFT | RIGHT

const convoyOwnername = "Screeps"

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
}

export class Season4784484ScoreProcess implements Process, Procedural {
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
    private readonly direction: HighwayDirection,
    private readonly commodityType: CommodityConstant,
    private readonly amount: number,
    private scoutName: CreepName | null,
  private haulerName: CreepName | null,
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
      state.haulerName
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, highwayEntranceRoomName: RoomName, direction: HighwayDirection, commodityType: CommodityConstant, amount: number): Season4784484ScoreProcess {
    return new Season4784484ScoreProcess(Game.time, processId, roomName, highwayEntranceRoomName, direction, commodityType, amount, null, null)
  }

  public processShortDescription(): string {
    const haulerDescription = ((): string => {
      if (this.haulerName == null) {
        return "no creep"
      }
      const hauler = Game.creeps[this.haulerName]
      if (hauler == null) {
        return "finished"
      }
      return `hauler in ${hauler.pos}`
    })()
    return `${roomLink(this.roomName)} ${coloredResourceType(this.commodityType)} ${haulerDescription}`
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
    const body: BodyPartConstant[] = [
      ...Array(armorCount).fill(MOVE),
      ...Array(requiredCarryCount).fill(CARRY),
      ...Array(requiredCarryCount).fill(MOVE),
    ]

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
    if (creep.v5task != null) {
      // TODO: convoyがいたらタスクをキルする
      // TODO: 攻撃Creepがいたらfallbackする
      return
    }

    if (creep.room.name === this.roomName) {
      if (creep.store.getUsedCapacity(this.commodityType) <= 0) {
        creep.v5task = FleeFromAttackerTask.create(MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, this.commodityType, this.amount)))
        return
      }

      const waypoints = GameMap.getWaypoints(this.roomName, this.highwayEntranceRoomName) ?? []
      creep.v5task = FleeFromAttackerTask.create(MoveToRoomTask.create(this.highwayEntranceRoomName, waypoints))
      return
    }

    if (creep.store.getUsedCapacity(this.commodityType) <= 0) {
      creep.say("done", true)
      return
    }

    const convoyCreep = this.findConvoyCreep(creep.room)
    if (convoyCreep == null) {
      if (creep.ticksToLive != null && creep.ticksToLive < (GameConstants.creep.life.lifeTime * 0.55)) {
        creep.say("back to room")
        const waypoints: RoomName[] = [
          this.highwayEntranceRoomName,
          ...(GameMap.getWaypoints(this.highwayEntranceRoomName, this.roomName) ?? []),
        ]
        const tasks: CreepTask[] = [
          MoveToRoomTask.create(this.roomName, waypoints),
          MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, this.commodityType)),
        ]
        creep.v5task = FleeFromAttackerTask.create(SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false }))
        return
      }

      // TODO: 入れ替わりになった場合
      const nextRoomName = this.nextRoomName(creep.room)
      this.moveToNextRoom(creep, nextRoomName)
      return
    }

    if (creep.transfer(convoyCreep, this.commodityType) === ERR_NOT_IN_RANGE) {
      creep.moveTo(convoyCreep, defaultMoveToOptions())
    }
  }

  private findConvoyCreep(room: Room): Creep | null {
    return room.find(FIND_HOSTILE_CREEPS).filter(creep => {
      if (creep.owner.username !== convoyOwnername) {
        return false
      }
      if (creep.store.getUsedCapacity(this.commodityType) <= 0) {
        return false
      }
      return true
    })[0] ?? null
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

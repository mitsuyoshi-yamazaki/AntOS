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
import { ResourceManager } from "utility/resource_manager"
import { decodeRoomPosition, Position } from "prototype/room_position"

ProcessDecoder.register("Season41035999ScoreFleetProcess", state => {
  return Season41035999ScoreFleetProcess.decode(state as Season41035999ScoreFleetProcessState)
})

type RoomExitDirection = TOP | BOTTOM | LEFT | RIGHT

const convoyOwnername = SYSTEM_USERNAME

const scoutCount = 4
const scoutRoles: CreepRole[] = [CreepRole.Scout]
const haulerRoles: CreepRole[] = [CreepRole.Hauler]

type FleetStateSpawning = {
  readonly case: "spawnng"
  readonly scoutNames: CreepName[]
  haulerName: CreepName | null
}
type FleetStateWithdrawing = {
  readonly case: "withdrawing"
  readonly scoutNames: CreepName[]
  readonly haulerName: CreepName
}
type FleetStateScoring = {
  readonly case: "scoring"
  readonly scoutNames: CreepName[]
  readonly haulerName: CreepName
}
type FleetStateFallback = {
  readonly case: "fallback"
  readonly scoutNames: CreepName[]
  readonly haulerName: CreepName
}
type FleetStateFinished = {
  readonly case: "finished"
  readonly scoutNames: CreepName[]
  readonly haulerName: CreepName
}
type FleetStateRunning = FleetStateWithdrawing | FleetStateScoring | FleetStateFallback | FleetStateFinished
type FleetState = FleetStateSpawning | FleetStateRunning

/**
 * - 常に次の部屋にはscoutがいる=2部屋の視界が確保されている状態
 * - scoutが1機になったらfallback(最後の1機は退却時の視界確保用)
 * - 前方から敵が現れたらfallback
 * - 後方から現れたら進み続ける
 */
interface Season41035999ScoreFleetProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly highwayEntranceRoomName: RoomName

  /// highwayEntranceRoomNameから向かう方向
  readonly direction: RoomExitDirection
  readonly commodityType: CommodityConstant
  readonly amount: number
  readonly fleetState: FleetState
  readonly suspendReason: string | null
  readonly logs: string[]
}

export class Season41035999ScoreFleetProcess implements Process, Procedural {
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
    private readonly direction: RoomExitDirection,
    private readonly commodityType: CommodityConstant,
    private readonly amount: number,
    private fleetState: FleetState,
    private suspendReason: string | null,
    private readonly logs: string[],
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}_${this.roomName}_${this.commodityType}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season41035999ScoreFleetProcessState {
    return {
      t: "Season41035999ScoreFleetProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      highwayEntranceRoomName: this.highwayEntranceRoomName,
      direction: this.direction,
      commodityType: this.commodityType,
      amount: this.amount,
      fleetState: this.fleetState,
      suspendReason: this.suspendReason,
      logs: this.logs,
    }
  }

  public static decode(state: Season41035999ScoreFleetProcessState): Season41035999ScoreFleetProcess {
    return new Season41035999ScoreFleetProcess(
      state.l,
      state.i,
      state.roomName,
      state.highwayEntranceRoomName,
      state.direction,
      state.commodityType,
      state.amount,
      state.fleetState,
      state.suspendReason,
      state.logs,
    )
  }

  public static create(processId: ProcessId, roomName: RoomName, highwayEntranceRoomName: RoomName, direction: RoomExitDirection, commodityType: CommodityConstant, amount: number, waitingPosition: Position, exitDirection: RoomExitDirection): Season41035999ScoreFleetProcess {
    const fleetState: FleetStateSpawning = {
      case: "spawnng",
      scoutNames: [],
      haulerName: null,
    }
    return new Season41035999ScoreFleetProcess(Game.time, processId, roomName, highwayEntranceRoomName, direction, commodityType, amount, fleetState, null, [])
  }

  public processShortDescription(): string {
    const haulerDescription = ((): string => {
      if (this.fleetState.haulerName == null) {
        return "no creep"
      }
      const hauler = Game.creeps[this.fleetState.haulerName]
      if (hauler == null) {
        return "finished"
      }
      return `hauler in ${hauler.pos}`
    })()

    const descriptions: string[] = [
      roomLink(this.roomName),
      coloredResourceType(this.commodityType),
      haulerDescription,
    ]
    if (this.suspendReason != null) {
      descriptions.push(this.suspendReason)
    }
    return descriptions.join(" ")
  }

  public processDescription(): string {
    const descriptions: string[] = [
      this.processShortDescription(),
      ...this.logs,
    ]
    return descriptions.join("\n")
  }

  public didReceiveMessage(message: string): string {
    // fallback
    // stop
    return "not implemented yet"
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    switch (this.fleetState.case) {
    case "spawnng":
      this.spawn(this.fleetState, roomResource)
      break
    case "withdrawing":
      this.withdraw(this.fleetState, roomResource)
      break
    case "scoring":
      this.score(this.fleetState)
      break
    case "fallback":
    case "finished":
    }

    const terminal = roomResource.activeStructures.terminal
    if (terminal != null) {
      this.runHauler(hauler, terminal)
    }
  }

  // ---- Scoring ---- //
  private score(fleetState: FleetStateScoring): void {

  }

  // ---- Withdraw ---- //
  private withdraw(fleetState: FleetStateWithdrawing, roomResource: OwnedRoomResource): void {
    if (roomResource.activeStructures.terminal == null) {
      this.suspend("no terminal")
      return
    }

    const { scouts, hauler } = this.getCreeps(fleetState)
    if (hauler == null || (hauler.ticksToLive != null && hauler.ticksToLive < 1000)) {
      this.suspend("hauler dying")
      return
    }

    if (hauler.store.getUsedCapacity(this.commodityType) > 0) {
      this.fleetState = {
        case: "scoring",
        scoutNames: fleetState.scoutNames,
        haulerName: fleetState.haulerName,
      }
      return
    }

    const terminal = roomResource.activeStructures.terminal
    const commodityAmount = terminal.store.getUsedCapacity(this.commodityType)
    if (commodityAmount < this.amount) {
      this.collectCommodity()
      return
    }

    if (hauler.withdraw(terminal, this.commodityType, this.amount) === ERR_NOT_IN_RANGE) {
      hauler.moveTo(terminal.pos, defaultMoveToOptions())
    }

    const fleet = new ScoreFleet(null, scouts)
    const nextRoomName = (GameMap.getWaypoints(this.roomName, this.highwayEntranceRoomName) ?? [])[0] ?? this.highwayEntranceRoomName
    fleet.wait(nextRoomName)
  }

  private collectCommodity(): void {
    ResourceManager.collect(this.commodityType, this.roomName, this.amount)
  }

  // ---- Spawn ---- //
  private spawn(fleetState: FleetStateSpawning, roomResource: OwnedRoomResource): void {
    const allCreeps = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)
    for (const creep of allCreeps) {
      if (hasNecessaryRoles(creep, scoutRoles) === true) {
        if (fleetState.scoutNames.includes(creep.name) === false) {
          fleetState.scoutNames.push(creep.name)
        }
        continue
      }
      if (hasNecessaryRoles(creep, haulerRoles) === true) {
        fleetState.haulerName = creep.name
        continue
      }
    }

    if (fleetState.scoutNames.length >= scoutCount) {
      if (fleetState.haulerName != null) {
        this.fleetState = {
          case: "withdrawing",
          haulerName: fleetState.haulerName,
          scoutNames: fleetState.scoutNames,
        }
        return
      }

      this.spawnHauler(roomResource)
      return
    }
    this.spawnScout()
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
      this.suspend("energy capacity insufficient")
      return
    }
    if (body.length > GameConstants.creep.body.bodyPartMaxCount) {
      PrimitiveLogger.programError(`${this.taskIdentifier} body too large (${body.length})`)
      this.suspend("body too large")
      return
    }

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Medium,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: haulerRoles,
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private spawnScout(): void {
    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: scoutRoles,
      body: [MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  // ---- Withdraw ---- //


  // ---- ---- //
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

  // ---- Utility ---- //
  private getCreeps(fleetState: FleetStateRunning): { scouts: Creep[], hauler: Creep | null } {
    const scouts = ((): Creep[] => {
      return fleetState.scoutNames.flatMap((scoutName): Creep[] => {
        const creep = Game.creeps[scoutName]
        if (creep == null) {
          return []
        }
        return [creep]
      })
    })()

    const hauler = ((): Creep | null => {
      if (fleetState.haulerName == null) {
        return null
      }
      return Game.creeps[fleetState.haulerName] ?? null
    })()

    return {
      scouts,
      hauler,
    }
  }

  private suspend(reason: string): void {
    this.suspendReason = reason
    OperatingSystem.os.suspendProcess(this.processId)
  }
}

class ScoreFleet {
  public constructor(
    private readonly haulerCreep: Creep | null,
    private readonly scoutCreeps: Creep[],
  ) { }

  public wait(nextRoom: RoomName): void {

  }

  public moveToNextRoom(direction: RoomExitDirection): void {

  }

  public score(scoreTarget: Creep): void {

  }
}

/**
 # SaboteurHarvestProcess
 ## 概要
 Sourceのharvest位置を全てブロックすることで部屋のEnergy利用を妨害する

 ## 備考
 harvestしない以上Invaderが発生することもなく、Creepが攻撃されることは想定しない
 */

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { CreepName, defaultMoveToOptions } from "prototype/creep"
import { World } from "world_info/world_info"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename, UniqueId } from "utility/unique_id"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { isEqualLocalPosition, Position } from "shared/utility/position"
import { GameConstants } from "utility/constants"
import { GameMap } from "game/game_map"
import { decodeRoomPosition, describePosition, RoomPositionFilteringOptions } from "prototype/room_position"
import { processLog } from "os/infrastructure/logger"
import { OwnedRoomProcess } from "process/owned_room_process"
import { MessageObserver } from "os/infrastructure/message_observer"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { RoomResources } from "room_resource/room_resources"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepBody } from "utility/creep_body"
import type { Timestamp } from "shared/utility/timestamp"
import { ListArguments } from "shared/utility/argument_parser/list_argument_parser"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"

ProcessDecoder.register("SaboteurHarvestProcess", state => {
  return SaboteurHarvestProcess.decode(state as SaboteurHarvestProcessState)
})

type Mutable<Type> = {
  -readonly [Key in keyof Type]: Type[Key]
}

type PositionInfo = {
  readonly position: Position
  creepName: CreepName
  nextCreepName: CreepName | null
}
type SpawningPositionInfo = {
  readonly position: Position
  creepName: CreepName | null
}

type AttackCreepState = {
  readonly name: CreepName
  targetId: Id<Creep> | null
}

/// RoomをObserveする
type SaboteurStateScouting = {
  readonly case: "scouting"
  reservedPosition: Position
}

type SaboteurStateStopped = {
  readonly case: "stopped"
  readonly until: Timestamp
  reservedPosition: Position
}

/// 全てのPositionを埋める
type SaboteurStateSpawning = {
  readonly case: "spawning"
  readonly positions: SpawningPositionInfo[]
  reservedPosition: Mutable<SpawningPositionInfo>
  attackCreep: AttackCreepState | null
}

/// 運用中
type SaboteurStateRunning = {
  readonly case: "running"
  readonly positions: PositionInfo[]
  reservedPosition: Mutable<SpawningPositionInfo>
  finishedCreepNames: CreepName[]
  attackCreep: AttackCreepState | null
}
type SaboteurState = SaboteurStateStopped | SaboteurStateScouting | SaboteurStateSpawning | SaboteurStateRunning

const creepLifetime = GameConstants.creep.life.lifeTime
const spawnInterval = Math.floor(creepLifetime / 12)
const spawnCycleInterval = Math.floor(creepLifetime - (spawnInterval * 1.5))
// const spawnInterval = 30  // FixMe: Debug
// const spawnCycleInterval = 200

interface SaboteurHarvestProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly travelDistance: number
  readonly saboteurState: SaboteurState
  readonly logs: string[]
}

// TODO: 遊撃を1Creep置いておく
export class SaboteurHarvestProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private readonly codename: string
  private spawnThreshold: number
  private get reservedPosition(): Position {
    switch (this.saboteurState.case) {
    case "stopped":
    case "scouting":
      return this.saboteurState.reservedPosition
    case "spawning":
    case "running":
      return this.saboteurState.reservedPosition.position
    }
  }

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly travelDistance: number,
    private saboteurState: SaboteurState,
    private logs: string[],
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}`
    this.codename = generateCodename(this.identifier, this.launchTime)

    this.spawnThreshold = creepLifetime - spawnCycleInterval + travelDistance
  }

  public encode(): SaboteurHarvestProcessState {
    return {
      t: "SaboteurHarvestProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      travelDistance: this.travelDistance,
      saboteurState: this.saboteurState,
      logs: this.logs,
    }
  }

  public static decode(state: SaboteurHarvestProcessState): SaboteurHarvestProcess {
    return new SaboteurHarvestProcess(state.l, state.i, state.roomName, state.targetRoomName, state.travelDistance ?? 50, state.saboteurState, state.logs ?? [])
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, travelDistance: number, reservedPosition: Position): SaboteurHarvestProcess {
    const saboteurState: SaboteurStateScouting = {
      case: "scouting",
      reservedPosition,
    }
    return new SaboteurHarvestProcess(Game.time, processId, roomName, targetRoomName, travelDistance, saboteurState, [])
  }

  public processShortDescription(): string {
    const stateDescription = ((): string => {
      switch (this.saboteurState.case) {
      case "stopped":
        return `stopped in ${this.saboteurState.until - Game.time} ticks`
      case "scouting":
        return "scouting"
      case "spawning":
        return `spawning, ${this.saboteurState.positions.length} positions`
      case "running":
        return `running, ${this.saboteurState.positions.length} positions`
      }
    })()

    const creeps = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)

    const descriptions: string[] = [
      roomLink(this.targetRoomName),
      stateDescription,
      `${creeps.length} creeps`,
    ]

    if (this.logs.length > 0) {
      descriptions.push(`${this.logs.length} logs`)
    }

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "reset", "show_log", "reset_log", "set_reserved_position"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "reset":
        this.saboteurState = {
          case: "scouting",
          reservedPosition: this.reservedPosition,
        }
        this.logs = []
        return this.killCreeps()
      case "show_log":
        if (this.logs.length <= 0) {
          return "no logs"
        }
        return `${this.logs.length} logs\n${this.logs.map(x => `- ${x}`).join("\n")}`
      case "reset_log":
        this.logs = []
        return "ok"
      case "set_reserved_position": {
        const listArguments = new ListArguments(components)
        const position = listArguments.localPosition(0, "position").parse()

        switch (this.saboteurState.case) {
        case "stopped":
        case "scouting":
          this.saboteurState.reservedPosition = position
          break
        case "spawning":
        case "running":
          this.saboteurState.reservedPosition.position = position
          break
        default: {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _: never = this.saboteurState
          throw `unimplemented case ${(this.saboteurState as SaboteurState).case}`
        }
        }
        return `set ${describePosition(position)}`
      }
      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  private killCreeps(): string {
    const creeps = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)
    creeps.forEach(creep => creep.suicide())

    return `${creeps.length} creep killed`
  }

  public runOnTick(): void {
    if (this.saboteurState.case === "stopped") {
      if (Game.time < this.saboteurState.until) {
        return
      }
      this.saboteurState = {
        case: "scouting",
        reservedPosition: this.saboteurState.reservedPosition,
      }
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const targetRoom = Game.rooms[this.targetRoomName]

    switch (this.saboteurState.case) {
    case "scouting": {
      const creeps = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)
      if (targetRoom != null) {
        this.saboteurState = this.calculateSpawningState(targetRoom)
        creeps.forEach(creep => {
          creep.say("finished")
          creep.suicide()
        })

        this.logStateChange(this.saboteurState)
        this.runSpawning(this.saboteurState, creeps, roomResource)
      } else {
        this.runScouting(this.saboteurState, creeps)
      }
      break
    }
    case "spawning": {
      const creeps = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)
      if (creeps.length >= this.saboteurState.positions.length) {
        const runningState = this.convertRunningState(this.saboteurState)
        if (runningState != null) {
          this.saboteurState = runningState
          this.logStateChange(this.saboteurState)
          this.run(this.saboteurState)
        } else {
          this.runSpawning(this.saboteurState, creeps, roomResource)
        }
      } else {
        this.runSpawning(this.saboteurState, creeps, roomResource)
      }
      break
    }
    case "running":
      this.run(this.saboteurState)
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.saboteurState
      break
    }
    }
  }

  // ---- Scouting ---- //
  private runScouting(state: SaboteurStateScouting, creeps: Creep[]): void {
    // Target roomがvisibleでない状態

    if (creeps.length <= 0) {
      this.spawnWorkerCreep()
    }

    creeps.forEach(creep => {
      if (creep.v5task != null) {
        return
      }
      if (creep.room.name !== this.targetRoomName) {
        creep.v5task = this.moveToRoomTask(creep)
        return
      }
    })
  }

  // ---- Spawning ---- //
  private runSpawning(state: SaboteurStateSpawning, creeps: Creep[], roomResource: OwnedRoomResource): void {
    // Attacker
    const attackCreepInstance = ((): [Creep, AttackCreepState] | null => {
      if (state.attackCreep == null) {
        return null
      }
      const creep = Game.creeps[state.attackCreep.name]
      if (creep != null) {
        return [creep, state.attackCreep]
      }
      state.attackCreep = null
      return null
    })()

    if (attackCreepInstance == null) {
      const body = CreepBody.create([], [MOVE, ATTACK], roomResource.room.energyCapacityAvailable, 10)
      state.attackCreep = {
        name: this.spawnCreep(body),
        targetId: null,
      }
    } else {
      const [attacker, attackCreepState] = attackCreepInstance
      const index = creeps.findIndex(creep => creep.name === attacker.name)
      if (index >= 0) {
        creeps.splice(index, 1)
      }

      this.runAttacker(attacker, attackCreepState)
    }

    // Worker
    if (state.reservedPosition.creepName != null && Game.creeps[state.reservedPosition.creepName] == null) {
      state.reservedPosition.creepName = null
    }
    state.positions.forEach(position => {
      if (position.creepName == null) {
        return
      }
      if (Game.creeps[position.creepName] != null) {
        return
      }
      position.creepName = null
    })

    const shouldSpawnWorker = ((): boolean => {
      const requiredWorkerCount = state.positions.length + 1  // reserved positionの分
      if (creeps.length >= requiredWorkerCount) {
        return false
      }
      creeps.sort((lhs, rhs) => (rhs.ticksToLive ?? creepLifetime) - (lhs.ticksToLive ?? creepLifetime))
      const youngestCreep = creeps[0] // Spawning時は
      if (youngestCreep == null) {
        return true
      }
      if ((creepLifetime - (youngestCreep.ticksToLive ?? creepLifetime)) > spawnInterval) {
        return true
      }
      return false
    })()

    if (shouldSpawnWorker === true) {
      this.spawnWorkerCreep()
    }

    const creepPositions = new Map<CreepName, Position>()
    const emptyPositions: SpawningPositionInfo[] = []

    state.positions.forEach(position => {
      if (position.creepName == null) {
        emptyPositions.push(position)
        return
      }
      creepPositions.set(position.creepName, position.position)
    })

    creeps.forEach(creep => {
      if (creep.v5task != null) {
        return
      }
      if (creep.room.name !== this.targetRoomName) {
        creep.v5task = this.moveToRoomTask(creep)
        return
      }

      const creepPosition = creepPositions.get(creep.name)
      if (creepPosition != null) {
        if (isEqualLocalPosition(creep.pos, creepPosition) === true) {
          return
        }
        creep.v5task = MoveToTask.create(decodeRoomPosition(creepPosition, creep.room.name), 0, {ignoreSwamp: true})
        return
      }

      const emptyPosition = emptyPositions.shift()
      if (emptyPosition == null) {
        if (state.reservedPosition.creepName != null) {
          creep.say("no pos")
          return
        }
        state.reservedPosition.creepName = creep.name
        creep.v5task = MoveToTask.create(decodeRoomPosition(state.reservedPosition.position, creep.room.name), 0, { ignoreSwamp: true })
        return
      }

      emptyPosition.creepName = creep.name
      creep.v5task = MoveToTask.create(decodeRoomPosition(emptyPosition.position, creep.room.name), 0, { ignoreSwamp: true })
    })
  }

  private runAttacker(creep: Creep, creepState: AttackCreepState): void {
    if (creep.v5task != null) {
      return
    }

    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = this.moveToRoomTask(creep)
      return
    }

    const target = ((): Creep | null => {
      if (creepState.targetId == null) {
        creep.say("f tgt1")
        return this.findTarget(creep.room, creep.pos)
      }
      const instance = Game.getObjectById(creepState.targetId)
      if (instance != null) {
        if (instance.room.name !== this.targetRoomName) {
          creep.say("f tgt2")
          return this.findTarget(creep.room, creep.pos)
        }
        if (instance.pos.isRoomEdge !== true) {
          if (instance.pos.getRangeTo(creep.pos) > 2) {
            const closerHostileCreep = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 2)[0]
            if (closerHostileCreep != null) {
              creep.say("c tgt")
              return closerHostileCreep
            }
          }
          return instance
        }
      }
      creep.say("f tgt3")
      return this.findTarget(creep.room, creep.pos)
    })()

    if (target == null) {
      creep.say("no tgt")
      return
    }

    creepState.targetId = target.id
    this.attack(creep, target)
  }

  private attack(creep: Creep, target: Creep): void {
    creep.moveTo(target.pos, defaultMoveToOptions())
    if (creep.pos.isNearTo(target.pos) === true) {
      creep.attack(target)
    }
  }

  private findTarget(room: Room, attackerPosition: RoomPosition): Creep | null {
    const sources = room.find(FIND_SOURCES)
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS).filter(creep => creep.pos.isRoomEdge !== true).map(creep => {
      const sourceDistances = sources.map(source => source.pos.getRangeTo(creep.pos))
      const sourceDistance = Math.min(...sourceDistances)
      return {
        creep,
        distancePriority: attackerPosition.getRangeTo(creep.pos) + (sourceDistance * 2), // 小さい方を優先
      }
    })

    hostileCreeps.sort((lhs, rhs) => lhs.distancePriority - rhs.distancePriority)
    if (hostileCreeps[0] == null) {
      return null
    }
    return hostileCreeps[0].creep
  }

  // ---- ---- //
  private run(state: SaboteurStateRunning): void {
    // Attacker
    const attackCreepInstance = ((): [Creep, AttackCreepState] | null => {
      if (state.attackCreep == null) {
        return null
      }
      const creep = Game.creeps[state.attackCreep.name]
      if (creep != null) {
        return [creep, state.attackCreep]
      }
      state.attackCreep = null
      return null
    })()

    if (attackCreepInstance != null) {
      const [attacker, attackCreepState] = attackCreepInstance
      this.runAttacker(attacker, attackCreepState)
    }

    // Reserve
    const reservedCreep = ((): Creep | null => {
      if (state.reservedPosition.creepName == null) {
        return null
      }
      return Game.creeps[state.reservedPosition.creepName] ?? null
    })()

    if (reservedCreep == null) {
      state.reservedPosition.creepName = this.spawnCreep([MOVE])
    } else {
      this.runReservedCreep(reservedCreep, state.reservedPosition.position)
    }

    // Worker
    const finishedCreepNames: CreepName[] = []
    state.finishedCreepNames.forEach(creepName => {
      const creep = Game.creeps[creepName]
      if (creep == null) {
        return
      }
      finishedCreepNames.push(creep.name)
      creep.say("finished")
      creep.suicide()
    })

    state.finishedCreepNames = finishedCreepNames

    let oldestCreepInfo = null as { position: PositionInfo, ticksToLive: number } | null
    let secondOldestTicksToLive = null as number | null
    let dyingPosition = null as { position: PositionInfo, ticksToLive: number, nextCreep: Creep } | null

    state.positions.forEach(position => {
      const creep = Game.creeps[position.creepName]
      if (creep == null) {
        this.addLog(`no creep in position at ${Game.time}`)
        this.saboteurState = {
          case: "stopped",
          until: Game.time + 1600,  // Invaderなどを想定
          reservedPosition: state.reservedPosition.position,
        }
        return
      }

      const nextCreep = ((): Creep | null => {
        if (position.nextCreepName == null) {
          return null
        }
        const c = Game.creeps[position.nextCreepName]
        if (c == null) {
          position.nextCreepName = null
          return null
        }
        return c
      })()

      if (nextCreep == null) {
        this.moveCreepToPosition(creep, position.position)

        if (creep.ticksToLive != null && (oldestCreepInfo == null || creep.ticksToLive < oldestCreepInfo.ticksToLive)) {
          secondOldestTicksToLive = oldestCreepInfo?.ticksToLive ?? null

          oldestCreepInfo = {
            position,
            ticksToLive: creep.ticksToLive,
          }
        }
        return
      }

      if (creep.ticksToLive != null && creep.ticksToLive < 2 && isEqualLocalPosition(creep.pos, position.position) !== true) {
        // 寿命が尽きようとしているのに位置についていない
        creep.say("dying")
        state.finishedCreepNames.push(creep.name)
        position.creepName = nextCreep.name
        position.nextCreepName = null
        return
      }

      if (nextCreep.pos.getRangeTo(creep.pos) <= 1) {
        creep.move(creep.pos.getDirectionTo(nextCreep.pos))
        nextCreep.move(nextCreep.pos.getDirectionTo(creep.pos))

        state.finishedCreepNames.push(creep.name)
        position.creepName = nextCreep.name
        position.nextCreepName = null

        creep.room.visual.line(creep.pos, nextCreep.pos, {
          width: 0.3,
        })
        return
      }

      this.moveCreepToPosition(nextCreep, position.position, 1)

      if (creep.room.name === nextCreep.room.name) {
        creep.room.visual.line(creep.pos, nextCreep.pos, {
          width: 0.05,
          opacity: 0.3,
          lineStyle: "dotted",
        })
      } else {
        const estimatedArrivalTime = this.travelDistance - (creepLifetime - (nextCreep.ticksToLive ?? creepLifetime))
        creep.room.visual.text(`${estimatedArrivalTime}`, creep.pos, {
          font: 0.5,
          strokeWidth: 0.2,
          align: "center",
        })
      }

      if (creep.ticksToLive != null && creep.ticksToLive < 50 && reservedCreep?.room.name === this.targetRoomName && nextCreep.room.name !== this.targetRoomName) {
        if (dyingPosition == null || creep.ticksToLive < dyingPosition.ticksToLive) {
          dyingPosition = {
            position,
            ticksToLive: creep.ticksToLive,
            nextCreep,
          }
        }
      }
    })

    if (oldestCreepInfo != null) {
      const shouldSpawn = ((): boolean => {
        if (oldestCreepInfo.ticksToLive < this.spawnThreshold) {
          return true
        }
        if (secondOldestTicksToLive == null) {
          return false
        }
        if ((secondOldestTicksToLive - spawnInterval) < this.spawnThreshold) {
          return true
        }
        return false
      })()

      if (shouldSpawn === true) {
        oldestCreepInfo.position.nextCreepName = this.spawnWorkerCreep()
      }
    }

    if (dyingPosition != null && reservedCreep != null) {
      const nextCreep = dyingPosition.nextCreep
      nextCreep.v5task = null
      reservedCreep.v5task = null

      dyingPosition.position.nextCreepName = reservedCreep.name
      state.reservedPosition.creepName = nextCreep.name

      this.addLog(`swap reserved creep ${reservedCreep.name} to ${nextCreep.name} for position ${describePosition(dyingPosition.position.position)} at ${Game.time}`)
    }
  }

  private runReservedCreep(creep: Creep, position: Position): void {
    if (creep.v5task != null) {
      return
    }
    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = this.moveToRoomTask(creep)
      return
    }
    const range = 3
    if (creep.pos.getRangeTo(position.x, position.y) <= range) {
      return
    }
    creep.v5task = MoveToTask.create(decodeRoomPosition(position, creep.room.name), range, { ignoreSwamp: true })
  }

  private moveCreepToPosition(creep: Creep, position: Position, range?: number): void {
    if (creep.v5task != null) {
      return
    }
    if (creep.room.name !== this.targetRoomName) {
      creep.v5task = this.moveToRoomTask(creep)
      return
    }
    if (creep.pos.getRangeTo(position.x, position.y) <= (range ?? 0)) {
      return
    }
    creep.v5task = MoveToTask.create(decodeRoomPosition(position, creep.room.name), range ?? 0, { ignoreSwamp: true })
  }

  // ---- ---- //
  private spawnWorkerCreep(): CreepName {
    return this.spawnCreep([MOVE])
  }

  private spawnCreep(body: BodyPartConstant[]): CreepName {
    const creepName = UniqueId.generateCreepName(this.codename)

    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [],
      body,
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
      name: creepName,
    })

    return creepName
  }

  private moveToRoomTask(creep: Creep): CreepTask {
    const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
    return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, waypoints))
  }

  private calculateSpawningState(targetRoom: Room): SaboteurStateSpawning {
    const options: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeTerrainWalls: true,
      excludeWalkableStructures: false,
    }

    const positions = targetRoom.find(FIND_SOURCES).flatMap((source): SpawningPositionInfo[] => {
      return source.pos.positionsInRange(1, options).map(position => ({position: position.raw, creepName: null}))
    })

    return {
      case: "spawning",
      positions,
      attackCreep: null,
      reservedPosition: {
        position: this.reservedPosition,
        creepName: null,
      },
    }
  }

  private convertRunningState(spawningState: SaboteurStateSpawning): SaboteurStateRunning | null {
    try {
      const positions: PositionInfo[] = spawningState.positions.map(position => {
        const converted = this.convertPositionInfo(position)
        if (converted == null) {
          throw "no creep"
        }
        return converted
      })

      const reservedPosition = this.convertPositionInfo(spawningState.reservedPosition)
      if (reservedPosition == null) {
        throw "no creep"
      }

      return {
        case: "running",
        positions,
        finishedCreepNames: [],
        attackCreep: spawningState.attackCreep,
        reservedPosition,
      }
    } catch {
      return null
    }
  }

  private convertPositionInfo(position: SpawningPositionInfo): PositionInfo | null {
    if (position.creepName == null) {
      return null
    }
    return {
      position: position.position,
      creepName: position.creepName,
      nextCreepName: null,
    }
  }

  private addLog(log: string): void {
    if (this.logs.includes(log) === true) {
      return
    }
    this.logs.push(log)
    PrimitiveLogger.notice(`${this.identifier} ${log}`)
  }

  private logStateChange(state: SaboteurState): void {
    processLog(this, `${coloredText("[State Changed]", "info")} ${state.case} in ${roomLink(this.targetRoomName)}`)
  }
}

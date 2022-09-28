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
import { CreepName } from "prototype/creep"
import { World } from "world_info/world_info"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { Position } from "shared/utility/position"
import type { Timestamp } from "shared/utility/timestamp"
import { GameConstants } from "utility/constants"
import { GameMap } from "game/game_map"
import { decodeRoomPosition, RoomPositionFilteringOptions } from "prototype/room_position"
import { processLog } from "os/infrastructure/logger"
import { OwnedRoomProcess } from "process/owned_room_process"
import { MessageObserver } from "os/infrastructure/message_observer"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"

ProcessDecoder.register("SaboteurHarvestProcess", state => {
  return SaboteurHarvestProcess.decode(state as SaboteurHarvestProcessState)
})

type CreepInfo = {
  readonly name: CreepName
  readonly timeToDie: Timestamp
}
type PartialPositionInfo = {
  readonly position: Position
  creep: CreepInfo | null
}
type PositionInfo = {
  readonly position: Position
  readonly creep: CreepInfo
}

type SaboteurStateSpawnFirstCreep = {
  readonly case: "spawn first creep"
}
type SaboteurStateScouting = {
  readonly case: "scouting"
  oldestCreepSpawnTime: Timestamp
}
type SaboteurStateSpawning = {
  readonly case: "spawning"
  readonly positions: PartialPositionInfo[]
  oldestCreepSpawnTime: Timestamp

  // TODO:
  readonly creepPositions: Map<CreepName, Readonly<{ timeToDie: Timestamp, position: Position }>>
  readonly emptyPositions: Position[]
}
type SaboteurStateRunning = {
  readonly case: "running"
  readonly positions: PositionInfo[]
  oldestCreepSpawnTime: Timestamp
}
type SaboteurState = SaboteurStateSpawnFirstCreep | SaboteurStateScouting | SaboteurStateSpawning | SaboteurStateRunning

const creepLifetime = GameConstants.creep.life.lifeTime
// const spawnInterval = Math.floor(creepLifetime / 10)
// const spawnCycleInterval = creepLifetime - spawnInterval
const spawnInterval = 30  // FixMe: Debug
const spawnCycleInterval = 300

interface SaboteurHarvestProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly stopRunningReasons: string[]
}

export class SaboteurHarvestProcess implements Process, Procedural, OwnedRoomProcess, MessageObserver {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private get waypoints(): RoomName[] {
    if (this._waypoints == null) {
      this._waypoints = GameMap.getWaypoints(this.roomName, this.targetRoomName) ?? []
    }
    return this._waypoints
  }

  private readonly codename: string

  private saboteurState = null as SaboteurState | null
  private _waypoints = null as RoomName[] | null

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private readonly stopRunningReasons: string[],
  ) {
    this.identifier = `${this.constructor.name}_${this.processId}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): SaboteurHarvestProcessState {
    return {
      t: "SaboteurHarvestProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      stopRunningReasons: this.stopRunningReasons,
    }
  }

  public static decode(state: SaboteurHarvestProcessState): SaboteurHarvestProcess {
    return new SaboteurHarvestProcess(state.l, state.i, state.roomName, state.targetRoomName, state.stopRunningReasons)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): SaboteurHarvestProcess {
    return new SaboteurHarvestProcess(Game.time, processId, roomName, targetRoomName, [])
  }

  public processShortDescription(): string {
    const stateDescription = ((): string => {
      switch (this.saboteurState?.case) {
      case null:
      case undefined:
        return "state: null"
      case "spawn first creep":
        return "spawn first creep"
      case "scouting":
        return "scouting"
      case "spawning":
        return `spawning, ${this.saboteurState.positions.length} positions`
      case "running":
        return `running, ${this.saboteurState.positions.length} positions`
      }
    })()

    const descriptions: string[] = [
      roomLink(this.targetRoomName),
      stateDescription,
    ]

    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "kill_creeps"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`
      case "kill_creeps":
        return this.killCreeps()
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
    if (this.stopRunningReasons.length > 0) {
      return
    }

    const creeps = World.resourcePools.getCreeps(this.roomName, this.identifier, () => true)
    const targetRoom = Game.rooms[this.targetRoomName]

    if (this.saboteurState == null) {
      this.saboteurState = this.calculateState(targetRoom ?? null, creeps)
    }

    switch (this.saboteurState.case) {
    case "spawn first creep":
      if (creeps[0] != null) {
        if (creeps[0].ticksToLive == null) {
          //
        } else {
          this.saboteurState = {
            case: "scouting",
            oldestCreepSpawnTime: Game.time - (creepLifetime - creeps[0].ticksToLive),
          }
          this.logStateChange(this.saboteurState)
          this.runScouting(this.saboteurState, creeps)
        }
      } else {
        this.runSpawnFirstCreep(this.saboteurState)
      }
      break
    case "scouting": {
      if (targetRoom != null) {
        this.saboteurState = this.calculateSpawningState(targetRoom, this.saboteurState.oldestCreepSpawnTime)
        this.logStateChange(this.saboteurState)
        this.runSpawning(this.saboteurState, creeps)
      } else {
        this.runScouting(this.saboteurState, creeps)
      }
      break
    }
    case "spawning": {
      const runningState = this.convertRunningState(this.saboteurState)
      if (runningState != null) {
        this.saboteurState = runningState
        this.logStateChange(this.saboteurState)
        this.run(this.saboteurState, creeps)
      } else {
        this.runSpawning(this.saboteurState, creeps)
      }
      break
    }
    case "running":
      this.run(this.saboteurState, creeps)
      break
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _: never = this.saboteurState
      break
    }
    }
  }

  // ---- Spawn First Creep ---- //
  private runSpawnFirstCreep(state: SaboteurStateSpawnFirstCreep): void {
    this.spawnCreep()
  }

  // ---- Scouting ---- //
  private runScouting(state: SaboteurStateScouting, creeps: Creep[]): void {
    // Target roomがvisibleでない状態

    const timeFromOldestCreepSpawn = Game.time - state.oldestCreepSpawnTime
    const requiredCreepCount = Math.floor(timeFromOldestCreepSpawn / spawnInterval) + 1
    if (requiredCreepCount > creeps.length) {
      console.log(`run scout, required: ${requiredCreepCount} = ${timeFromOldestCreepSpawn} / ${spawnInterval}, ${creeps.length} creeps`)
      this.spawnCreep()
    }

    creeps.forEach(creep => {
      if (creep.v5task != null) {
        return
      }
      creep.v5task = this.moveToRoomTask()
    })
  }

  // ---- Spawning ---- //
  private runSpawning(state: SaboteurStateSpawning, creeps: Creep[]): void {
    const timeFromOldestCreepSpawn = Game.time - state.oldestCreepSpawnTime
    const requiredCreepCount = Math.min(Math.floor(timeFromOldestCreepSpawn / spawnInterval) + 1, state.positions.length)
    if (requiredCreepCount > creeps.length) {
      console.log(`run scout, required: ${requiredCreepCount} = min(${timeFromOldestCreepSpawn} / ${spawnInterval}, ${state.positions.length}), ${creeps.length} creeps`)
      this.spawnCreep()
    }

    const creepInPosition = state.positions.flatMap((position): CreepName[] => {
      if (position.creep == null) {
        return []
      }
      return [position.creep.name]
    })
    const emptyPositions = state.positions.filter(position => position.creep == null)

    creeps.forEach(creep => {
      if (creep.v5task != null) {
        return
      }
      if (creep.room.name !== this.targetRoomName) {
        creep.v5task = this.moveToRoomTask()
        return
      }

      const emptyPosition = emptyPositions.shift()
      if (emptyPosition == null) {
        creep.v5task = MoveToTask.create(decodeRoomPosition({ x: 25, y: 25, r: creep.room.name }), 20)
        return
      }

      emptyPosition.creep = {
        name: creep.name,
        timeToDie: Game.time + (creep.ticksToLive ?? creepLifetime),
      }
      creep.v5task = MoveToTask.create(decodeRoomPosition(emptyPosition.position, creep.room.name), 0)
    })
  }

  // ---- ---- //
  private run(state: SaboteurStateRunning, creeps: Creep[]): void {

  }

  // ---- ---- //
  private spawnCreep(): void {
    World.resourcePools.addSpawnCreepRequest(this.roomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [],
      body: [MOVE],
      initialTask: this.moveToRoomTask(),
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private moveToRoomTask(): CreepTask {
    return FleeFromAttackerTask.create(MoveToRoomTask.create(this.targetRoomName, this.waypoints))
  }

  private calculateState(targetRoom: Room | null, creeps: Creep[]): SaboteurState {
    creeps.sort((lhs, rhs) => (lhs.ticksToLive ?? creepLifetime) - (rhs.ticksToLive ?? creepLifetime))
    const oldestCreep = creeps[creeps.length - 1]

    if (oldestCreep == null || oldestCreep.ticksToLive == null) {
      return {
        case: "spawn first creep",
      }
    }

    const oldestCreepSpawnTime = Game.time - (creepLifetime - oldestCreep.ticksToLive)
    if (targetRoom == null) {
      return {
        case: "scouting",
        oldestCreepSpawnTime,
      }
    }

    const spawningState = this.calculateSpawningState(targetRoom, oldestCreepSpawnTime)
    const runningState = this.convertRunningState(spawningState)

    if (runningState == null) {
      return spawningState
    }
    return runningState
  }

  private calculateSpawningState(targetRoom: Room, oldestCreepSpawnTime: Timestamp): SaboteurStateSpawning {
    const options: RoomPositionFilteringOptions = {
      excludeItself: true,
      excludeStructures: true,
      excludeTerrainWalls: true,
      excludeWalkableStructures: false,
    }
    const positions = targetRoom.find(FIND_SOURCES).flatMap((source): PartialPositionInfo[] => {
      return source.pos.positionsInRange(1, options).map(position => ({position: position, creep: null}))
    })

    return {
      case: "spawning",
      positions,
      oldestCreepSpawnTime,
    }
  }

  private convertRunningState(spawningState: SaboteurStateSpawning): SaboteurStateRunning | null {
    try {
      const positions: PositionInfo[] = spawningState.positions.map(position => {
        if (position.creep == null) {
          throw "no creep"
        }
        const creep = Game.creeps[position.creep.name]
        if (creep == null) {
          position.creep = null
          throw "creep dead"
        }
        return {
          position: position.position,
          creep: {
            name: creep.name,
            timeToDie: Game.time + (creep.ticksToLive ?? creepLifetime),
          }
        }
      })

      positions.sort((lhs, rhs) => lhs.creep.timeToDie - rhs.creep.timeToDie)
      const eariest = positions[0]
      if (eariest == null) {
        throw "no positions"
      }
      const oldestCreepSpawnTime = eariest.creep.timeToDie

      return {
        case: "running",
        positions,
        oldestCreepSpawnTime,
      }
    } catch {
      return null
    }
  }

  private addStopRunningReason(reason: string): void {
    if (this.stopRunningReasons.includes(reason) === true) {
      return
    }
    this.stopRunningReasons.push(reason)
  }

  private logStateChange(state: SaboteurState): void {
    processLog(this, `${coloredText("[State Changed]", "info")} ${state.case} in ${roomLink(this.targetRoomName)}`)
  }
}

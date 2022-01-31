import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "process/process_decoder"
import type { RoomName } from "utility/room_name"
import type { Timestamp } from "utility/timestamp"
import type { CreepName } from "prototype/creep"
import { CreepBody } from "utility/creep_body"
import { GameConstants } from "utility/constants"
import { World } from "world_info/world_info"
import { generateCodename } from "utility/unique_id"

ProcessDecoder.register("Season4628862DowngradeRoomProcess", state => {
  return Season4628862DowngradeRoomProcess.decode(state as Season4628862DowngradeRoomProcessState)
})

type DowngradeProcessStateWaiting = {
  case: "waiting"
}
type DowngradeProcessStateSpawning = {
  case: "spawning"
  readonly creepNames: CreepName[]
}
type DowngradeProcessStateRunning = {
  case: "running"
  readonly creepNames: CreepName[]
}
type DowngradeProcessState = DowngradeProcessStateWaiting | DowngradeProcessStateSpawning | DowngradeProcessStateRunning

export interface Season4628862DowngradeRoomProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly upgradeBlockedBy: Timestamp
  readonly state: DowngradeProcessState
  readonly estimatedDuration: number
  readonly creepCount: number
}

/**
 * 複数のDowngraderを派遣する
 */
export class Season4628862DowngradeRoomProcess implements Process, Procedural {
  public readonly taskIdentifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private upgradeBlockedBy: Timestamp,
    private state: DowngradeProcessState,
    private estimatedDuration: number,
    private readonly creepCount: number,
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.processId}_${this.roomName}_${this.targetRoomName}`
    this.codename = generateCodename(this.taskIdentifier, this.launchTime)
  }

  public encode(): Season4628862DowngradeRoomProcessState {
    return {
      t: "Season4628862DowngradeRoomProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      upgradeBlockedBy: this.upgradeBlockedBy,
      state: this.state,
      estimatedDuration: this.estimatedDuration,
      creepCount: this.creepCount,
    }
  }

  public static decode(state: Season4628862DowngradeRoomProcessState): Season4628862DowngradeRoomProcess {
    return new Season4628862DowngradeRoomProcess(state.l, state.i, state.roomName, state.targetRoomName, state.upgradeBlockedBy, state.state, state.estimatedDuration, state.creepCount)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, upgradeBlocked: number, estimatedDuration: number, creepCount: number): Season4628862DowngradeRoomProcess {
    const upgradeBlockedBy = Game.time + upgradeBlocked
    const state: DowngradeProcessStateWaiting = {
      case: "waiting",
    }
    return new Season4628862DowngradeRoomProcess(Game.time, processId, roomName, targetRoomName, upgradeBlockedBy, state, estimatedDuration, creepCount)
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)} =&gt ${roomLink(this.targetRoomName)}`
  }

  public runOnTick(): void {
    switch (this.state.case) {
    case "waiting":
      if (this.shouldStartSpawning() === true) {
        this.state = {
          case: "spawning",
          creepNames: [],
        }
      }
      return

    case "spawning": {
      const spawningState = this.state
      const creeps = World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true)
      creeps.forEach(creep => {
        if (spawningState.creepNames.includes(creep.name) === true) {
          return
        }
        spawningState.creepNames.push(creep.name)
      })

      if (spawningState.creepNames.length >= this.creepCount) {
        this.state = {
          case: "running",
          creepNames: [...spawningState.creepNames],
        }
      }
      this.spawnDowngrader()
      return
    }

    case "running":
    }
  }

  private shouldStartSpawning(): boolean {
    const estimatedBodySize = 8
    const bodyCost = CreepBody.cost([CLAIM, MOVE])
    const spawnCount = 2
    const spawnTime = estimatedBodySize * bodyCost * GameConstants.creep.life.spawnTime + 1
    const totalSpawnTime = spawnTime * this.creepCount / spawnCount

    return (this.upgradeBlockedBy - totalSpawnTime) < Game.time
  }

  private spawnDowngrader(): void {

  }

  private moveDowngraderToOwnedRoomEdge(): void {

  }
}

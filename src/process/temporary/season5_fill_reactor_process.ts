import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { CreepName } from "prototype/creep"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { OperatingSystem } from "os/os"
import { GameMap } from "game/game_map"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { RoomResources } from "room_resource/room_resources"
import { CreepBody } from "utility/creep_body"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { Timestamp } from "shared/utility/timestamp"

ProcessDecoder.register("Season5FillReactorProcess", state => {
  return Season5FillReactorProcess.decode(state as Season5FillReactorProcessState)
})

interface Season5FillReactorProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly creepName: CreepName | null
  readonly bodyUnitSize: number
  readonly startsAt: Timestamp
}

export class Season5FillReactorProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetRoomName: RoomName,
    private creepName: CreepName | null,
    private readonly bodyUnitSize: number,
    private readonly startsAt: Timestamp,
  ) {
    this.identifier = `${this.constructor.name}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season5FillReactorProcessState {
    return {
      t: "Season5FillReactorProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      creepName: this.creepName,
      bodyUnitSize: this.bodyUnitSize,
      startsAt: this.startsAt,
    }
  }

  public static decode(state: Season5FillReactorProcessState): Season5FillReactorProcess {
    return new Season5FillReactorProcess(state.l, state.i, state.roomName, state.targetRoomName, state.creepName, state.bodyUnitSize, state.startsAt)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, bodyUnitSize: number, startsAt: Timestamp): Season5FillReactorProcess {
    return new Season5FillReactorProcess(Game.time, processId, roomName, targetRoomName, null, bodyUnitSize, startsAt)
  }

  public processShortDescription(): string {
    if (Game.time < this.startsAt) {
      return `starts in ${this.startsAt - Game.time} ticks`
    }

    const creepDescription = ((): string => {
      if (this.creepName == null) {
        return "not spawned"
      }
      const creep = Game.creeps[this.creepName]
      if (creep == null) {
        return "creep died"
      }
      return `1cr in ${roomLink(creep.room.name)}`
    })()
    return `${roomLink(this.targetRoomName)}, ${creepDescription}`
  }

  public runOnTick(): void {
    if (Game.time < this.startsAt) {
      return
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    if (this.creepName == null) {
      const claimer = World.resourcePools.getCreeps(this.roomName, this.identifier)[0]
      if (claimer != null) {
        this.creepName = claimer.name
      }
    } else {
      if (Game.creeps[this.creepName] == null) {
        OperatingSystem.os.killProcess(this.processId)
      }
    }

    if (this.creepName == null) {
      const body = CreepBody.create([], [MOVE, CARRY], roomResource.room.energyCapacityAvailable, this.bodyUnitSize)

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

    World.resourcePools.assignTasks(
      this.roomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.fillTask(creep, roomResource),
    )
  }

  private fillTask(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {
    const task = ((): CreepTask | null => {
      if (creep.room.name === this.roomName) {
        if (creep.store.getUsedCapacity(RESOURCE_THORIUM) <= 0) {
          const terminal = roomResource.activeStructures.terminal
          if (terminal != null && terminal.store.getUsedCapacity(RESOURCE_THORIUM) > 0) {
            return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, RESOURCE_THORIUM))
          }
        }
      }
      if (creep.room.name !== this.targetRoomName) {
        const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
        return MoveToRoomTask.create(this.targetRoomName, waypoints, true)
      }

      const reactor = creep.room.find(FIND_REACTORS)[0]
      if (reactor == null) {
        creep.say("no rctr")
        return null
      }
      if (creep.store.getUsedCapacity(RESOURCE_THORIUM) <= 0) {
        creep.say("no thrum")
        return null
      }
      if (creep.pos.isNearTo(reactor.pos) !== true) {
        return MoveToTask.create(reactor.pos, 1, { ignoreSwamp: true })
      }
      creep.transfer(reactor, RESOURCE_THORIUM)
      return null
    })()

    if (task == null) {
      return null
    }
    return FleeFromAttackerTask.create(task)
  }
}

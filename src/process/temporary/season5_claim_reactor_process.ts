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

ProcessDecoder.register("Season5ClaimReactorProcess", state => {
  return Season5ClaimReactorProcess.decode(state as Season5ClaimReactorProcessState)
})

interface Season5ClaimReactorProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly creepName: CreepName | null
}

export class Season5ClaimReactorProcess implements Process, Procedural {
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
  ) {
    this.identifier = `${this.constructor.name}_${this.targetRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): Season5ClaimReactorProcessState {
    return {
      t: "Season5ClaimReactorProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      creepName: this.creepName,
    }
  }

  public static decode(state: Season5ClaimReactorProcessState): Season5ClaimReactorProcess {
    return new Season5ClaimReactorProcess(state.l, state.i, state.roomName, state.targetRoomName, state.creepName)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName): Season5ClaimReactorProcess {
    return new Season5ClaimReactorProcess(Game.time, processId, roomName, targetRoomName, null)
  }

  public processShortDescription(): string {
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
      World.resourcePools.addSpawnCreepRequest(this.roomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [],
        body: [MOVE, MOVE, MOVE, MOVE, MOVE, CLAIM],
        initialTask: null,
        taskIdentifier: this.identifier,
        parentRoomName: null,
      })
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.claimTask(creep),
    )
  }

  private claimTask(creep: Creep): CreepTask | null {
    const task = ((): CreepTask | null => {
      if (creep.room.name !== this.targetRoomName) {
        const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
        return MoveToRoomTask.create(this.targetRoomName, waypoints, true)
      }

      const reactor = creep.room.find(FIND_REACTORS)[0]
      if (reactor == null) {
        creep.say("no rctr")
        return null
      }
      if (reactor.my === true) {
        creep.say("done")
        return null
      }
      if (creep.pos.isNearTo(reactor.pos) !== true) {
        return MoveToTask.create(reactor.pos, 1, {ignoreSwamp: true})
      }
      creep.claimReactor(reactor)
      return null
    })()

    if (task == null) {
      return null
    }
    return FleeFromAttackerTask.create(task)
  }
}

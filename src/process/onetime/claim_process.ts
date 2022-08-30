import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomName } from "utility/room_name"
import { OperatingSystem } from "os/os"
import { ProcessDecoder } from "process/process_decoder"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { UniqueId } from "utility/unique_id"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveClaimControllerTask } from "v5_object_task/creep_task/combined_task/move_claim_controller_task"
import { GameMap } from "game/game_map"
import { CreepBody } from "utility/creep_body"
import { RoomResources } from "room_resource/room_resources"

ProcessDecoder.register("ClaimProcess", state => {
  return ClaimProcess.decode(state as ClaimProcessState)
})

export interface ClaimProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetRoomName: RoomName
  readonly maxClaimSize: number
}

export class ClaimProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    public readonly targetRoomName: RoomName,
    private readonly maxClaimSize: number,
  ) {
    this.taskIdentifier = `${this.processId}_${this.constructor.name}_${this.targetRoomName}`
    this.codename = UniqueId.generateCodename(this.taskIdentifier, this.launchTime)
  }

  public encode(): ClaimProcessState {
    return {
      t: "ClaimProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetRoomName: this.targetRoomName,
      maxClaimSize: this.maxClaimSize,
    }
  }

  public static decode(state: ClaimProcessState): ClaimProcess {
    return new ClaimProcess(state.l, state.i, state.roomName, state.targetRoomName, state.maxClaimSize)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetRoomName: RoomName, maxClaimSize: number | null): ClaimProcess {
    return new ClaimProcess(Game.time, processId, roomName, targetRoomName, maxClaimSize ?? 1)
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)} =&gt ${roomLink(this.targetRoomName)}`
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      OperatingSystem.os.suspendProcess(this.processId)
      return
    }

    const shouldQuit = ((): boolean => {
      const targetRoom = Game.rooms[this.targetRoomName]
      if (targetRoom == null) {
        return false
      }
      if (targetRoom.controller == null) {
        return true
      }
      if (targetRoom.controller.my === true) {
        return true
      }
      return false
    })()

    if (shouldQuit === true) {
      OperatingSystem.os.killProcess(this.processId)
      return
    }

    const claimerCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)
    if (claimerCount <= 0) {
      const body = CreepBody.create([], [MOVE, CLAIM], roomResource.room.energyCapacityAvailable, this.maxClaimSize)

      World.resourcePools.addSpawnCreepRequest(this.roomName, {
        priority: CreepSpawnRequestPriority.Low,
        numberOfCreeps: 1,
        codename: this.codename,
        roles: [],
        body,
        initialTask: null,
        taskIdentifier: this.taskIdentifier,
        parentRoomName: null,
      })
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => {
        const task = this.claimTask(creep)
        if (task == null) {
          return null
        }
        return FleeFromAttackerTask.create(task)
      },
      () => true,
    )
  }

  private claimTask(creep: Creep): CreepTask | null {
    if (creep.room.name === this.targetRoomName) {
      if (creep.room.controller == null || creep.room.controller.my === true) {
        return null
      }
    }

    const waypoints = GameMap.getWaypoints(creep.room.name, this.targetRoomName) ?? []
    return MoveClaimControllerTask.create(this.targetRoomName, waypoints, false)
  }
}

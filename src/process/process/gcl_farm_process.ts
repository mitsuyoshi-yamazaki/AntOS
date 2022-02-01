import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { RoomName } from "utility/room_name"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
import { World } from "world_info/world_info"
import { CreepRole, hasNecessaryRoles } from "prototype/creep_role"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToRoomTask } from "v5_object_task/creep_task/meta_task/move_to_room_task"
import { GameMap } from "game/game_map"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { AttackControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/attack_controller_api_wrapper"
import { ClaimControllerApiWrapper } from "v5_object_task/creep_task/api_wrapper/claim_controller_api_wrapper"

ProcessDecoder.register("GclFarmProcess", state => {
  return GclFarmProcess.decode(state as GclFarmProcessState)
})

const claimerRoles: CreepRole[] = [CreepRole.Claimer]

interface GclFarmProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly parentRoomNames: RoomName[]
}

export class GclFarmProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly roomName: RoomName,
    private readonly parentRoomNames: RoomName[], // 近い順
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): GclFarmProcessState {
    return {
      t: "GclFarmProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      parentRoomNames: this.parentRoomNames,
    }
  }

  public static decode(state: GclFarmProcessState): GclFarmProcess {
    return new GclFarmProcess(state.l, state.i, state.roomName, state.parentRoomNames)
  }

  public static create(processId: ProcessId, roomName: RoomName, parentRoomNames: RoomName[]): GclFarmProcess {
    return new GclFarmProcess(Game.time, processId, roomName, parentRoomNames)
  }

  public processShortDescription(): string {
    return `${roomLink(this.roomName)}, parents: ${this.parentRoomNames.map(roomName => roomLink(roomName)).join(",")}`
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      this.claimRoom()
      return
    }


  }

  private claimRoom(): void {
    const claimerCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, creep => hasNecessaryRoles(creep, claimerRoles))
    if (claimerCount <= 0) {
      this.spawnClaimer()
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => this.claimerRole(creep),
      creep => hasNecessaryRoles(creep, claimerRoles),
    )
  }

  private spawnClaimer(): void {
    const parentRoomName = this.parentRoomNames[0]
    if (parentRoomName == null) {
      if ((Game.time % 29) === 11) {
        PrimitiveLogger.programError(`${this.constructor.name} ${this.processId} no parent rooms`)
      }
      return
    }
    World.resourcePools.addSpawnCreepRequest(parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [...claimerRoles],
      body: [CLAIM, MOVE],
      initialTask: null,
      taskIdentifier: this.taskIdentifier,
      parentRoomName: this.roomName,
    })
  }

  private claimerRole(creep: Creep): CreepTask | null {
    if (creep.room.name !== this.roomName) {
      const waypoints = GameMap.getWaypoints(creep.room.name, this.roomName) ?? []
      return FleeFromAttackerTask.create(MoveToRoomTask.create(this.roomName, waypoints))
    }

    const controller = creep.room.controller
    if (controller == null) {
      PrimitiveLogger.programError(`${this.taskIdentifier} no controller in ${roomLink(this.roomName)}`)
      return null
    }

    const shouldAttack = ((): boolean => {
      if (controller.owner != null && controller.owner.username !== Game.user.name) {
        return true
      }
      if (controller.reservation != null && controller.reservation.username !== Game.user.name) {
        return true
      }
      return false
    })()

    if (shouldAttack === true) {
      return FleeFromAttackerTask.create(MoveToTargetTask.create(AttackControllerApiWrapper.create(controller)))
    }

    return FleeFromAttackerTask.create(MoveToTargetTask.create(ClaimControllerApiWrapper.create(controller)))
  }
}

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredText, roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { ProcessDecoder } from "../process_decoder"
import { World } from "world_info/world_info"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepRole } from "prototype/creep_role"
import { Timestamp } from "shared/utility/timestamp"
import { RoomResources } from "room_resource/room_resources"
import { SystemCalls } from "os/system_calls"
import { CreepBody } from "utility/creep_body"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { RandomMoveTask } from "v5_object_task/creep_task/meta_task/random_move_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { TransferEnergyApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_energy_api_wrapper"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { PickupApiWrapper } from "v5_object_task/creep_task/api_wrapper/pickup_api_wrapper"
import { CreepName } from "prototype/creep"

ProcessDecoder.register("CollectDroppedResourceOnceProcess", state => {
  return CollectDroppedResourceOnceProcess.decode(state as CollectDroppedResourceOnceProcessState)
})

interface CollectDroppedResourceOnceProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly creepName: CreepName
}

export class CollectDroppedResourceOnceProcess implements Process, Procedural {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly creepName: CreepName,
  ) {
    this.identifier = `${this.constructor.name}_${this.launchTime}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): CollectDroppedResourceOnceProcessState {
    return {
      t: "CollectDroppedResourceOnceProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      creepName: this.creepName,
    }
  }

  public static decode(state: CollectDroppedResourceOnceProcessState): CollectDroppedResourceOnceProcess {
    return new CollectDroppedResourceOnceProcess(state.l, state.i, state.roomName, state.creepName)
  }

  public static create(processId: ProcessId, roomName: RoomName, creepName: CreepName): CollectDroppedResourceOnceProcess {
    return new CollectDroppedResourceOnceProcess(Game.time, processId, roomName, creepName)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName),
    ]

    return descriptions.join(", ")
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      SystemCalls.systemCall()?.suspendProcess(this.processId)
      return
    }

    World.resourcePools.assignTasks(
      this.roomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.taskFor(creep, roomResource),
    )
  }

  private taskFor(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {
    if (creep.store.getUsedCapacity() > 0) {
      const storage = this.getStorage(roomResource)
      if (storage == null) {
        creep.say("no str")

        if (creep.pos.findInRange(FIND_MY_CREEPS, 1).length > 0) {
          return RandomMoveTask.create()
        }
        return null
      }

      if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
        return MoveToTargetTask.create(TransferEnergyApiWrapper.create(storage))
      }

      const resourceType = Array.from(Object.keys(creep.store))[0] as ResourceConstant | undefined
      if (resourceType == null) {
        creep.say("1")
        return null
      }
      return MoveToTargetTask.create(TransferResourceApiWrapper.create(storage, resourceType))
    }

    const resource = this.getDroppedResource(roomResource)
    if (resource == null) {
      if (creep.pos.findInRange(FIND_MY_CREEPS, 1).length > 0) {
        return RandomMoveTask.create()
      }
      return null
    }

    return MoveToTargetTask.create(PickupApiWrapper.create(resource))
  }

  private getDroppedResource(roomResource: OwnedRoomResource): Resource | null {
    const resources = [...roomResource.droppedResources]
    resources.sort((lhs, rhs) => rhs.amount - lhs.amount)

    return resources[0] ?? null
  }

  private getStorage(roomResource: OwnedRoomResource): StructureStorage | StructureTerminal | null {
    const storage = roomResource.activeStructures.storage
    if (storage != null && storage.store.getFreeCapacity() > 1000) {
      return storage
    }

    const terminal = roomResource.activeStructures.terminal
    if (terminal != null && terminal.store.getFreeCapacity() > 1000) {
      return terminal
    }

    return null
  }
}

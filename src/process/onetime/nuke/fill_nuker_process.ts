import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredResourceType, roomLink } from "utility/log"
import { ProcessState } from "../../process_state"
import { ProcessDecoder } from "../../process_decoder"
import { World } from "world_info/world_info"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { processLog } from "os/infrastructure/logger"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepBody } from "utility/creep_body"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { OwnedRoomProcess } from "process/owned_room_process"
import { SystemCalls } from "os/system_calls"
import { isV5CreepMemory } from "prototype/creep"

ProcessDecoder.register("FillNukerProcess", state => {
  return FillNukerProcess.decode(state as FillNukerProcessState)
})

interface FillNukerProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly nukerId: Id<StructureNuker>
}

export class FillNukerProcess implements Process, Procedural, OwnedRoomProcess {
  public readonly identifier: string
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.roomName
  }

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly nukerId: Id<StructureNuker>,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): FillNukerProcessState {
    return {
      t: "FillNukerProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      nukerId: this.nukerId,
    }
  }

  public static decode(state: FillNukerProcessState): FillNukerProcess {
    return new FillNukerProcess(state.l, state.i, state.roomName, state.nukerId)
  }

  public static create(processId: ProcessId, nuker: StructureNuker): FillNukerProcess {
    return new FillNukerProcess(Game.time, processId, nuker.room.name, nuker.id)
  }

  public processShortDescription(): string {
    const nukerStatus = ((): string => {
      const nuker = Game.getObjectById(this.nukerId)
      if (nuker == null) {
        return "no nuker"
      }

      const status = (resourceType: RESOURCE_ENERGY | RESOURCE_GHODIUM): string => {
        if (nuker.store.getFreeCapacity(resourceType) <= 0) {
          return `${coloredResourceType(resourceType)}: full`
        }
        return `${coloredResourceType(resourceType)}: ${Math.floor((nuker.store.getUsedCapacity(resourceType) / nuker.store.getCapacity(resourceType)) * 100)}%`
      }

      return `${status(RESOURCE_ENERGY)}, ${status(RESOURCE_GHODIUM)}`
    })()

    const descriptions: string[] = [
      roomLink(this.roomName),
      nukerStatus,
    ]

    return descriptions.join(", ")
  }

  public runOnTick(): void {
    if (Game.time - this.launchTime > 4000) {
      this.suicide(`${this.identifier} didn't finish in ${Game.time - this.launchTime} ticks`)
      return
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    const nuker = Game.getObjectById(this.nukerId)

    if (roomResource == null || nuker == null) {
      this.suicide(`${this.identifier} no room resource or no nuker in ${roomLink(this.roomName)}`)
      return
    }

    const fillingEnergy = nuker.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    const fillingGhodium = nuker.store.getFreeCapacity(RESOURCE_GHODIUM) > 0

    if (fillingEnergy !== true && fillingGhodium !== true) {
      processLog(this, `finish filling ${nuker} in ${roomLink(this.roomName)}`)
      this.suicide()
      return
    }

    const canFillEnergy = fillingEnergy === true && roomResource.getResourceAmount(RESOURCE_ENERGY) > 50000
    const canFillGhodium = fillingGhodium === true && roomResource.getResourceAmount(RESOURCE_GHODIUM) > 0

    const shouldSpawn = ((): boolean => {
      if (roomResource.hostiles.creeps.length > 0) {
        return false
      }
      const creepCounnt = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)
      if (creepCounnt > 0) {
        return false
      }
      if (canFillEnergy !== true && canFillGhodium !== true) {
        return false
      }
      return true
    })()

    if (shouldSpawn === true) {
      const body = CreepBody.create([], [CARRY, CARRY, MOVE], roomResource.room.energyCapacityAvailable, 4)

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
      creep => this.newTaskFor(creep, nuker, roomResource, canFillEnergy, canFillGhodium),
      () => true,
    )
  }

  private newTaskFor(creep: Creep, nuker: StructureNuker, roomResource: OwnedRoomResource, canFillEnergy: boolean, canFillGhodium: boolean): CreepTask | null {
    if (creep.store.getUsedCapacity(RESOURCE_ENERGY) > 0) {
      return MoveToTargetTask.create(TransferResourceApiWrapper.create(nuker, RESOURCE_ENERGY))
    }
    if (creep.store.getUsedCapacity(RESOURCE_GHODIUM) > 0) {
      return MoveToTargetTask.create(TransferResourceApiWrapper.create(nuker, RESOURCE_GHODIUM))
    }

    if (canFillGhodium === true) {
      const task = this.withdrawTask(roomResource, RESOURCE_GHODIUM)
      if (task != null) {
        return task
      }
    }

    if (canFillEnergy === true) {
      const task = this.withdrawTask(roomResource, RESOURCE_ENERGY, 30000)
      if (task != null) {
        return task
      }
    }

    creep.say("waiting")
    return this.waitTask(creep, roomResource)
  }

  private withdrawTask(roomResource: OwnedRoomResource, resourceType: ResourceConstant, minimumResourceAmount?: number): CreepTask | null {
    if (minimumResourceAmount != null && roomResource.getResourceAmount(resourceType) < minimumResourceAmount) {
      return null
    }
    if (roomResource.activeStructures.terminal != null && roomResource.activeStructures.terminal.store.getUsedCapacity(resourceType) > 0) {
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(roomResource.activeStructures.terminal, resourceType))
    }
    if (roomResource.activeStructures.storage != null && roomResource.activeStructures.storage.store.getUsedCapacity(resourceType) > 0) {
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(roomResource.activeStructures.storage, resourceType))
    }
    return null
  }

  private waitTask(creep: Creep, roomResource: OwnedRoomResource): CreepTask | null {
    const waitingPosition = roomResource.roomInfoAccessor.config.getGenericWaitingPosition()
    if (waitingPosition == null) {
      return null
    }
    if (creep.pos.isEqualTo(waitingPosition) === true) {
      return null
    }
    return MoveToTask.create(waitingPosition, 0)
  }

  private suicide(errorMessage?: string): void {
    World.resourcePools.getCreeps(this.roomName, this.taskIdentifier, () => true).forEach(creep => {
      if (!isV5CreepMemory(creep.memory)) {
        return
      }
      creep.v5task = null
      creep.memory.i = null // reallocate
    })

    if (errorMessage != null) {
      PrimitiveLogger.fatal(errorMessage)
    }
    SystemCalls.systemCall()?.killProcess(this.processId)
  }
}

import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { ProcessState } from "process/process_state"
import { CreepRole } from "prototype/creep_role"
import { generateCodename } from "utility/unique_id"
import { World } from "world_info/world_info"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { MoveToTargetTask } from "v5_object_task/creep_task/combined_task/move_to_target_task"
import { PrimitiveLogger } from "os/infrastructure/primitive_logger"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"
import type { RoomName } from "shared/utility/room_name_types"
import { isMineralBoostConstant, isResourceConstant } from "shared/utility/resource"
import { RoomResources } from "room_resource/room_resources"
import { BoostLabInfo } from "room_resource/room_info"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { ProcessDecoder } from "process/process_decoder"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { ResourceManager } from "utility/resource_manager"
import { OwnedRoomProcess } from "process/owned_room_process"
import { BoostLabChargerProcessLauncher } from "./boost_lab_charger_process_launcher"
import { SystemCalls } from "os/system_calls"

ProcessDecoder.register("BoostLabChargerProcess", state => {
  return BoostLabChargerProcess.decode(state as BoostLabChargerProcessState)
})

BoostLabChargerProcessLauncher.load({
  getRunningProcess(roomName: RoomName): BoostLabChargerProcess | null {
    const processList = SystemCalls.systemCall()?.listAllProcesses() ?? []

    for (const processInfo of processList) {
      const process = processInfo.process
      if (!(process instanceof BoostLabChargerProcess)) {
        continue
      }
      if (process.parentRoomName !== roomName) {
        continue
      }
      return process
    }
    return null
  },

  launch(roomName: RoomName): BoostLabChargerProcess | null {
    return SystemCalls.systemCall()?.addProcess(null, processId => BoostLabChargerProcess.create(processId, roomName)) ?? null
  },
})

const noBoostReason = "no boost"

type StructureLabInfo = {
  readonly lab: StructureLab
  readonly boost: MineralBoostConstant
}

export interface BoostLabChargerProcessState extends ProcessState {
  readonly parentRoomName: RoomName
  readonly stopSpawningReasons: string[]
}

export class BoostLabChargerProcess implements Process, Procedural, OwnedRoomProcess {
  public get taskIdentifier(): string {
    return this.identifier
  }
  public get ownedRoomName(): RoomName {
    return this.parentRoomName
  }

  public readonly identifier: string
  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    public readonly parentRoomName: RoomName,
    private readonly stopSpawningReasons: string[],
  ) {
    this.identifier = `${this.constructor.name}_${this.parentRoomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): BoostLabChargerProcessState {
    return {
      t: "BoostLabChargerProcess",
      l: this.launchTime,
      i: this.processId,
      parentRoomName: this.parentRoomName,
      stopSpawningReasons: this.stopSpawningReasons,
    }
  }

  public static decode(state: BoostLabChargerProcessState): BoostLabChargerProcess {
    return new BoostLabChargerProcess(state.l, state.i, state.parentRoomName, state.stopSpawningReasons)
  }

  public static create(processId: ProcessId, parentRoomName: RoomName): BoostLabChargerProcess {
    return new BoostLabChargerProcess(Game.time, processId, parentRoomName, [])
  }

  public processShortDescription(): string {
    const numberOfCreeps = World.resourcePools.countCreeps(this.parentRoomName, this.identifier)
    const boostDescriptions = ((): string[] => {
      const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
      if (roomResource == null) {
        return []
      }
      return this.boostLabInfo(roomResource).map(labState => coloredResourceType(labState.boost))
    })()
    return `${roomLink(this.parentRoomName)} ${numberOfCreeps}cr ${boostDescriptions.join(",")}`
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.parentRoomName)
    if (roomResource == null) {
      return
    }

    this.transferRequiredResources(roomResource)

    const boostLabInfo = this.boostLabInfo(roomResource)
    if (boostLabInfo.length <= 0) {
      this.addStopSpawningReason(noBoostReason)
    }

    const labs: StructureLabInfo[] = boostLabInfo.flatMap(labState => {
      const lab = Game.getObjectById(labState.labId)
      if (lab == null) {
        if ((Game.time % 17) === 5) {
          PrimitiveLogger.fatal(`${this.identifier} target lab ${labState.labId} not found ${roomLink(this.parentRoomName)}`)
        }
        return []
      }
      return {
        boost: labState.boost,
        lab,
      }
    })

    const terminal = roomResource.activeStructures.terminal
    if (terminal == null) {
      PrimitiveLogger.fatal(`${this.identifier} target terminal not found ${roomLink(this.parentRoomName)}`)
      return
    }

    const needResourceTransfer = ((): boolean => {
      for (const labInfo of labs) {
        if (terminal.store.getUsedCapacity(labInfo.boost) <= 0) {
          continue
        }
        if (labInfo.lab.mineralType != null && labInfo.lab.store.getFreeCapacity(labInfo.lab.mineralType) <= 0) {
          continue
        }
        return true
      }
      return false
    })()
    const shouldCollectResources = roomResource.roomInfo.config?.collectResources ?? false
    const creepCount = World.resourcePools.countCreeps(this.parentRoomName, this.identifier)
    if (creepCount < 1 && (needResourceTransfer === true || shouldCollectResources === true)) {
      this.requestCreep()
    }

    this.runCreep(terminal, labs, shouldCollectResources, roomResource)
  }

  private transferRequiredResources(roomResource: OwnedRoomResource): void {
    if ((Game.time % 17) !== 3) {
      return
    }

    const requiredBoost = roomResource.roomInfoAccessor.boostLabs.find(boostLabInfo => boostLabInfo.requredAmount > 0)
    if (requiredBoost == null) {
      return
    }

    const terminal = roomResource.activeStructures.terminal
    if (terminal == null) {
      return
    }

    const result = ResourceManager.collect(requiredBoost.boost, this.parentRoomName, requiredBoost.requredAmount)
    switch (result.resultType) {
    case "succeeded":
      roomResource.roomInfoAccessor.decreaseRequiredBoostAmount(requiredBoost.boost, result.value)
      break
    case "failed": {
      if (result.reason.sentAmount <= 0) {
        PrimitiveLogger.log(`${coloredText("[Error]", "error")} ${this.taskIdentifier} failed to collect ${coloredResourceType(requiredBoost.boost)}: ${result.reason.errorMessage}`)
      }
      roomResource.roomInfoAccessor.decreaseRequiredBoostAmount(requiredBoost.boost, result.reason.sentAmount)
      break
    }
    }
  }

  private requestCreep(): void {
    World.resourcePools.addSpawnCreepRequest(this.parentRoomName, {
      priority: CreepSpawnRequestPriority.Low,
      numberOfCreeps: 1,
      codename: this.codename,
      roles: [CreepRole.Hauler, CreepRole.Mover],
      body: [CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE, CARRY, CARRY, MOVE],
      initialTask: null,
      taskIdentifier: this.identifier,
      parentRoomName: null,
    })
  }

  private runCreep(terminal: StructureTerminal, labs: StructureLabInfo[], shouldCollectResources: boolean, roomResource: OwnedRoomResource): void {
    World.resourcePools.assignTasks(
      this.parentRoomName,
      this.identifier,
      CreepPoolAssignPriority.Low,
      creep => this.creepTask(creep, terminal, labs, shouldCollectResources, roomResource),
    )
  }

  private creepTask(creep: Creep, terminal: StructureTerminal, labs: StructureLabInfo[], shouldCollectResources: boolean, roomResource: OwnedRoomResource): CreepTask | null {
    if (creep.store.getUsedCapacity() <= 0 && creep.ticksToLive != null && creep.ticksToLive < 50) {
      creep.say("dying")
      return null
    }
    if (shouldCollectResources === true) {
      return this.collectResourceTask(creep, terminal, labs, roomResource)
    }

    if (creep.store.getUsedCapacity() > 0) {
      const resourceType = Object.keys(creep.store)[0] as ResourceConstant | null
      if (resourceType != null && labs.every(l => l.boost !== resourceType)) {
        if (terminal.store.getFreeCapacity(resourceType) > 0) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, resourceType))
        }
        if (roomResource.activeStructures.storage != null) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(roomResource.activeStructures.storage, resourceType))
        }
        PrimitiveLogger.fatal(`${this.taskIdentifier} no place to transfer`)
        return null
      }
    }

    if (creep.store.getUsedCapacity() <= 0) {
      const container = creep.room.find(FIND_STRUCTURES, { filter: { structureType: STRUCTURE_CONTAINER } }).find(container => {
        if (!(container instanceof StructureContainer)) {
          return false
        }
        if (container.store.getUsedCapacity() === container.store.getUsedCapacity(RESOURCE_ENERGY)) {
          return false
        }
        const resourceType = Object.keys(container.store)[0] as ResourceConstant | null
        if (resourceType == null || !isMineralBoostConstant(resourceType)) {
          return false
        }
        return true
      }) as StructureContainer | null
      if (container != null) {
        const resourceType = Object.keys(container.store)[0] as ResourceConstant | null
        if (resourceType != null && isMineralBoostConstant(resourceType)) {
          return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(container, resourceType))
        }
      }
    }

    for (const labInfo of labs) {
      if (creep.store.getUsedCapacity(labInfo.boost) <= 0) {
        continue
      }
      if (labInfo.lab.store.getFreeCapacity(labInfo.boost) <= 0) {
        if (terminal.store.getFreeCapacity(labInfo.boost) > 0) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, labInfo.boost))
        }
        if (roomResource.activeStructures.storage != null) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(roomResource.activeStructures.storage, labInfo.boost))
        }
        PrimitiveLogger.fatal(`${this.taskIdentifier} no place to transfer`)
        return null
      }
      return MoveToTargetTask.create(TransferResourceApiWrapper.create(labInfo.lab, labInfo.boost))
    }

    for (const labInfo of labs) {
      if (labInfo.lab.store.getFreeCapacity(labInfo.boost) <= 0) {
        continue
      }
      if (terminal.store.getUsedCapacity(labInfo.boost) <= 0) {
        continue
      }
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(terminal, labInfo.boost))
    }

    if (creep.store.getUsedCapacity() <= 0) {
      for (const labInfo of labs) {
        if (labInfo.lab.mineralType == null || labInfo.lab.mineralType === labInfo.boost) {
          continue
        }
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(labInfo.lab, labInfo.lab.mineralType))
      }
    }

    const waitingPosition = roomResource.roomInfoAccessor.config.getGenericWaitingPosition()
    if (waitingPosition != null && creep.pos.isEqualTo(waitingPosition) !== true) {
      return MoveToTask.create(waitingPosition, 0)
    }
    creep.say("boosted")
    return null
  }

  private collectResourceTask(creep: Creep, terminal: StructureTerminal, labs: StructureLabInfo[], roomResource: OwnedRoomResource): CreepTask | null {
    creep.say("collect")
    if (creep.store.getUsedCapacity() > 0) {
      const resourceType = Object.keys(creep.store)[0]
      if (resourceType != null && isResourceConstant(resourceType)) {

        if (terminal.store.getFreeCapacity(resourceType) > 0) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(terminal, resourceType))
        }
        if (roomResource.activeStructures.storage != null) {
          return MoveToTargetTask.create(TransferResourceApiWrapper.create(roomResource.activeStructures.storage, resourceType))
        }
        PrimitiveLogger.fatal(`${this.taskIdentifier} no place to transfer`)
        return null
      }
      PrimitiveLogger.programError(`${this.identifier} ${resourceType} is not resource constant ${roomLink(this.parentRoomName)}`)
      return null
    }

    for (const labInfo of labs) {
      if (labInfo.lab.mineralType == null) {
        continue
      }
      if (labInfo.lab.store.getUsedCapacity(labInfo.lab.mineralType) <= 0) {
        continue
      }
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(labInfo.lab, labInfo.lab.mineralType))
    }
    creep.say("no mineral")
    return null
  }

  // ---- Utility ---- //
  private boostLabInfo(roomResource: OwnedRoomResource): BoostLabInfo[] {
    return roomResource.roomInfoAccessor.getBoostLabs()
  }

  private addStopSpawningReason(reason: string): void {
    if (this.stopSpawningReasons.includes(reason) === true) {
      return
    }
    this.stopSpawningReasons.push(reason)
  }
}


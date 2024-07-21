import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import type { RoomName } from "shared/utility/room_name_types"
import { coloredResourceType, coloredText, roomLink } from "utility/log"
import { World } from "world_info/world_info"
import { generateCodename } from "utility/unique_id"
import { RoomResources } from "room_resource/room_resources"
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
import { ProcessDecoder } from "process/process_decoder"
import { ProcessState } from "process/process_state"
import { MineralCompoundIngredients } from "shared/utility/resource"

ProcessDecoder.register("ReverseReactionProcess", state => {
  return ReverseReactionProcess.decode(state as ReverseReactionProcessState)
})

interface ReverseReactionProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly compoundType: MineralCompoundConstant
  readonly stopReason: string | null
}

export class ReverseReactionProcess implements Process, Procedural, OwnedRoomProcess {
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
    private readonly compoundType: MineralCompoundConstant,
    private stopReason: string | null,
  ) {
    this.identifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.identifier, this.launchTime)
  }

  public encode(): ReverseReactionProcessState {
    return {
      t: "ReverseReactionProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      compoundType: this.compoundType,
      stopReason: this.stopReason,
    }
  }

  public static decode(state: ReverseReactionProcessState): ReverseReactionProcess {
    return new ReverseReactionProcess(state.l, state.i, state.roomName, state.compoundType, state.stopReason)
  }

  public static create(processId: ProcessId, roomName: RoomName, compoundType: MineralCompoundConstant): ReverseReactionProcess {
    return new ReverseReactionProcess(Game.time, processId, roomName, compoundType, null)
  }

  public processShortDescription(): string {
    const descriptions: string[] = [
      roomLink(this.roomName),
      coloredResourceType(this.compoundType),
    ]
    if (this.stopReason != null) {
      descriptions.push(`stopped by: ${this.stopReason}`)
    }
    return descriptions.join(", ")
  }

  public didReceiveMessage(message: string): string {
    const commandList = ["help", "stop", "resume"]
    const components = message.split(" ")
    const command = components.shift()

    try {
      switch (command) {
      case "help":
        return `Commands: ${commandList}`

      case "stop":
        if (this.stopReason != null) {
          throw `Already stopped by: ${this.stopReason}`
        }
        this.stopReason = "manually"
        return "Stopped"

      case "resume": {
        if (this.stopReason == null) {
          throw "Already running"
        }
        const reason = this.stopReason
        this.stopReason = null
        return `Resumed (stop reason was: ${reason})`
      }

      default:
        throw `Invalid command ${command}, see "help"`
      }
    } catch (error) {
      return `${coloredText("[Error]", "error")} ${error}`
    }
  }

  public runOnTick(): void {
    if (this.stopReason != null) {
      return
    }

    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const canRun = ((): boolean => {
      if (roomResource.roomInfo.config == null || roomResource.roomInfo.config.researchCompounds == null) {
        return true
      }
      if (Array.from(Object.keys(roomResource.roomInfo.config.researchCompounds)).length > 0) {
        return false
      }
      return true
    })()
    if (canRun !== true) {
      // ResearchTaskと干渉するのであればこちらを止める
      this.stopReason = "researching"
      return
    }

    const researchLab = roomResource.roomInfo.researchLab
    if (researchLab == null || researchLab.outputLabs.length <= 0) {
      this.stopReason = "no output labs"
      return
    }

    const inputLabs = this.getLabs([researchLab.inputLab1, researchLab.inputLab2])
    const inputLab1 = inputLabs[0]
    const inputLab2 = inputLabs[1]
    if (inputLab1 == null || inputLab2 == null) {
      this.stopReason = "no input labs"
      return
    }

    const shouldSpawn = ((): boolean => {
      if (roomResource.hostiles.creeps.length > 0) {
        return false
      }
      const creepCounnt = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)
      if (creepCounnt > 0) {
        return false
      }

      if (roomResource.getResourceAmount(this.compoundType) <= 0) {
        return false
      }
      return true
    })()

    if (shouldSpawn === true) {
      const body = CreepBody.create([], [CARRY, CARRY, MOVE], roomResource.room.energyCapacityAvailable, 3)

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

    const outputLabs = this.getLabs(researchLab.outputLabs)
    outputLabs.forEach(lab => {
      if (lab.cooldown > 0) {
        return
      }
      if (lab.mineralType !== this.compoundType) {
        return
      }
      lab.reverseReaction(inputLab1, inputLab2)
    })

    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => this.newTaskFor(creep, roomResource, inputLab1, inputLab2, outputLabs),
      () => true,
    )
  }

  private newTaskFor(creep: Creep, roomResource: OwnedRoomResource, inputLab1: StructureLab, inputLab2: StructureLab, outputLabs: StructureLab[]): CreepTask | null {
    if (creep.store.getUsedCapacity(this.compoundType) > 0) {
      outputLabs.sort((lhs, rhs) => lhs.store.getUsedCapacity(this.compoundType) - rhs.store.getUsedCapacity(this.compoundType))
      const outputLabToTransfer = outputLabs[0]

      if (outputLabToTransfer == null) {
        this.stopReason = "no output labs"
        return null
      }
      return MoveToTargetTask.create(TransferResourceApiWrapper.create(outputLabToTransfer, this.compoundType))
    }

    if (creep.store.getUsedCapacity() > 0) {
      const resourceType = Object.keys(creep.store)[0] as ResourceConstant | undefined
      if (resourceType == null) {
        creep.say("?")
        return null
      }
      if (roomResource.activeStructures.terminal != null && roomResource.activeStructures.terminal.store.getFreeCapacity(resourceType) > 0) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(roomResource.activeStructures.terminal, resourceType))
      }
      if (roomResource.activeStructures.storage != null && roomResource.activeStructures.storage.store.getFreeCapacity(resourceType) > 0) {
        return MoveToTargetTask.create(TransferResourceApiWrapper.create(roomResource.activeStructures.storage, resourceType))
      }
      creep.say("no str")
      return null
    }

    const outputLabToWithdraw = outputLabs.find(lab => lab.mineralType != null && lab.mineralType !== this.compoundType)
    if (outputLabToWithdraw != null && outputLabToWithdraw.mineralType != null) {
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(outputLabToWithdraw, outputLabToWithdraw.mineralType))
    }

    const inputLabs = [inputLab1, inputLab2]
    const ingredients = MineralCompoundIngredients[this.compoundType]
    const ingredientList = [ingredients.lhs, ingredients.rhs]
    const inputLabToWithdraw = inputLabs.find(lab => {
      if (lab.mineralType == null) {
        return false
      }
      if (ingredientList.includes(lab.mineralType) !== true) {
        return true
      }
      if (lab.store.getUsedCapacity(lab.mineralType) >= 1500) {
        return true
      }
      return false
    })
    if (inputLabToWithdraw != null && inputLabToWithdraw.mineralType != null) {
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(inputLabToWithdraw, inputLabToWithdraw.mineralType))
    }


    outputLabs.sort((lhs, rhs) => lhs.store.getUsedCapacity(this.compoundType) - rhs.store.getUsedCapacity(this.compoundType))
    const outputLabToTransfer = outputLabs[0]
    if (outputLabToTransfer != null && outputLabToTransfer.store.getFreeCapacity(this.compoundType) > 200) {
      if (roomResource.activeStructures.storage != null && roomResource.activeStructures.storage.store.getUsedCapacity(this.compoundType) > 0) {
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(roomResource.activeStructures.storage, this.compoundType))
      }
      if (roomResource.activeStructures.terminal != null && roomResource.activeStructures.terminal.store.getUsedCapacity(this.compoundType) > 0) {
        return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(roomResource.activeStructures.terminal, this.compoundType))
      }
    }

    const inputLabWithResource = inputLabs.find(lab => {
      if (lab.mineralType == null) {
        return false
      }
      if (ingredientList.includes(lab.mineralType) !== true) {
        return true
      }
      if (lab.store.getUsedCapacity(lab.mineralType) >= 100) {
        return true
      }
      return false
    })
    if (inputLabWithResource != null && inputLabWithResource.mineralType != null) {
      return MoveToTargetTask.create(WithdrawResourceApiWrapper.create(inputLabWithResource, inputLabWithResource.mineralType))
    }

    creep.say("nth to do")
    return this.waitTask(creep, roomResource)
  }

  private getLabs(ids: Id<StructureLab>[]): StructureLab[] {
    return ids.flatMap((id): StructureLab[] => {
      const lab = Game.getObjectById(id)
      if (lab == null) {
        return []
      }
      return [lab]
    })
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
}

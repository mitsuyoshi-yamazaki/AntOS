import { Procedural } from "process/procedural"
import { Process, ProcessId } from "process/process"
import { roomLink } from "utility/log"
import { ProcessState } from "../process_state"
import { RoomName } from "utility/room_name"
import { ProcessDecoder } from "process/process_decoder"
import { World } from "world_info/world_info"
import { RoomResources } from "room_resource/room_resources"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { CreepSpawnRequestPriority } from "world_info/resource_pool/creep_specs"
import { generateCodename } from "utility/unique_id"
import { CreepBody } from "utility/creep_body"
import { CreepTask } from "v5_object_task/creep_task/creep_task"
import { CreepPoolAssignPriority } from "world_info/resource_pool/creep_resource_pool"
import { FleeFromAttackerTask } from "v5_object_task/creep_task/combined_task/flee_from_attacker_task"
import { MoveToTask } from "v5_object_task/creep_task/meta_task/move_to_task"
import { RunApiTask } from "v5_object_task/creep_task/combined_task/run_api_task"
import { TransferResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/transfer_resource_api_wrapper"
import { SequentialTask } from "v5_object_task/creep_task/combined_task/sequential_task"
import { SuicideApiWrapper } from "v5_object_task/creep_task/api_wrapper/suicide_api_wrapper"
import { WithdrawResourceApiWrapper } from "v5_object_task/creep_task/api_wrapper/withdraw_resource_api_wrapper"

ProcessDecoder.register("WithdrawStructureProcess", state => {
  return WithdrawStructureProcess.decode(state as WithdrawStructureProcessState)
})

export type WithdrawStructureProcessTargetType = StructureFactory | StructureContainer
type TargetType = WithdrawStructureProcessTargetType
const targetStructureTypes = [
  STRUCTURE_FACTORY,
  STRUCTURE_CONTAINER,
]
export function isWithdrawStructureProcessTargetType(structure: AnyStructure): structure is TargetType {
  if ((targetStructureTypes as StructureConstant[]).includes(structure.structureType) === true) {
    return true
  }
  return false
}

export interface WithdrawStructureProcessState extends ProcessState {
  readonly roomName: RoomName
  readonly targetIds: Id<TargetType>[]
}

export class WithdrawStructureProcess implements Process, Procedural {
  public readonly taskIdentifier: string

  private readonly codename: string

  private constructor(
    public readonly launchTime: number,
    public readonly processId: ProcessId,
    private readonly roomName: RoomName,
    private readonly targetIds: Id<TargetType>[],
  ) {
    this.taskIdentifier = `${this.constructor.name}_${this.roomName}`
    this.codename = generateCodename(this.taskIdentifier, this.launchTime)
  }

  public encode(): WithdrawStructureProcessState {
    return {
      t: "WithdrawStructureProcess",
      l: this.launchTime,
      i: this.processId,
      roomName: this.roomName,
      targetIds: this.targetIds,
    }
  }

  public static decode(state: WithdrawStructureProcessState): WithdrawStructureProcess {
    return new WithdrawStructureProcess(state.l, state.i, state.roomName, state.targetIds)
  }

  public static create(processId: ProcessId, roomName: RoomName, targetIds: Id<TargetType>[]): WithdrawStructureProcess {
    return new WithdrawStructureProcess(Game.time, processId, roomName, targetIds)
  }

  public processShortDescription(): string {
    const structures = new Map<StructureConstant, number>()
    const missingStructureIds: Id<TargetType>[] = []

    this.targetIds.forEach(structureId => {
      const structure = Game.getObjectById(structureId)
      if (structure == null) {
        missingStructureIds.push(structureId)
        return
      }
      const structureType = structure.structureType
      structures.set(structureType, (structures.get(structureType) ?? 0) + 1)
    })

    const descriptions: string[] = [
      roomLink(this.roomName),
    ]
    if (structures.size > 0) {
      descriptions.push("no targets")
    } else {
      const structureDescription = Array.from(structures.entries()).map(([structureType, count]) => `${count} ${structureType}`).join(", ")
      descriptions.push(`targets: ${structureDescription}`)
    }
    if (missingStructureIds.length > 0) {
      descriptions.push(`missing: ${missingStructureIds.join(", ")}`)
    }

    return descriptions.join(", ")
  }

  public runOnTick(): void {
    const roomResource = RoomResources.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    const resourceStore = roomResource.activeStructures.terminal ?? roomResource.activeStructures.storage
    if (resourceStore == null) {
      return
    }

    const targetStructures: TargetType[] = this.targetIds.flatMap(structureId => {
      const structure = Game.getObjectById(structureId)
      if (structure == null) {
        return []
      }
      if (structure.store.getUsedCapacity() <= 0) {
        return []
      }
      return [structure]
    })

    const haulerCount = World.resourcePools.countCreeps(this.roomName, this.taskIdentifier, () => true)
    const shouldSpawn = ((): boolean => {
      if (haulerCount > 0) {
        return false
      }
      if (targetStructures.length <= 0) {
        return false
      }
      return true
    })()

    if (shouldSpawn === true) {
      this.spawnHauler(roomResource)
    }

    this.runHauler(resourceStore, targetStructures)
  }

  private spawnHauler(roomResource: OwnedRoomResource): void {
    const body = CreepBody.create([], [CARRY, CARRY, MOVE], roomResource.room.energyCapacityAvailable, 5)

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

  private runHauler(store: StructureTerminal | StructureStorage, targetStructures: TargetType[]): void {
    World.resourcePools.assignTasks(
      this.roomName,
      this.taskIdentifier,
      CreepPoolAssignPriority.Low,
      creep => {
        const task = this.newHaulerTask(creep, store, targetStructures)
        if (task == null) {
          return null
        }
        return FleeFromAttackerTask.create(task)
      },
      () => true,
    )
  }

  private newHaulerTask(creep: Creep, store: StructureTerminal | StructureStorage, targetStructures: TargetType[]): CreepTask | null {
    if (creep.store.getUsedCapacity() > 0) {
      const storedResourceTypes = Array.from(Object.keys(creep.store)) as ResourceConstant[]
      const tasks: CreepTask[] = [
        MoveToTask.create(store.pos, 1),
        ...storedResourceTypes.map(resourceType => RunApiTask.create(TransferResourceApiWrapper.create(store, resourceType))),
      ]
      return SequentialTask.create(tasks, {ignoreFailure: false, finishWhenSucceed: false})
    }

    const target = targetStructures[0]
    if (target == null) {
      creep.say("done")
      return RunApiTask.create(SuicideApiWrapper.create())
    }

    const storedResourceTypes = Array.from(Object.keys(target.store)) as ResourceConstant[]
    const tasks: CreepTask[] = [
      MoveToTask.create(target.pos, 1),
      ...storedResourceTypes.map(resourceType => RunApiTask.create(WithdrawResourceApiWrapper.create(target, resourceType))),
    ]
    return SequentialTask.create(tasks, { ignoreFailure: false, finishWhenSucceed: false })
  }
}

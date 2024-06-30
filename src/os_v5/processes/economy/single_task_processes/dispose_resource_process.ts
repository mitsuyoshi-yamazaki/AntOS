import { Process, processDefaultIdentifier, ProcessDependencies, ProcessId, ReadonlySharedMemory } from "os_v5/process/process"
import { ProcessDecoder } from "os_v5/system_calls/process_manager/process_decoder"
import { RoomName } from "shared/utility/room_name_types"
import { ConsoleUtility } from "shared/utility/console_utility/console_utility"
import { V3BridgeSpawnRequestProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_spawn_request_process"
import { CreepDistributorProcessApi } from "os_v5/processes/game_object_management/creep/creep_distributor_process"
import { CreepTaskStateManagementProcessApi, TaskDrivenCreep, TaskDrivenCreepMemory } from "os_v5/processes/game_object_management/creep/creep_task_state_management_process"
import { CreepBody } from "utility/creep_body_v2"
import { SystemCalls } from "os_v5/system_calls/interface"
import { CreepTask } from "os_v5/processes/game_object_management/creep/creep_task/creep_task"
import { MyRoom } from "shared/utility/room"
import { DepositConstant, MineralConstant } from "shared/utility/resource"
import { OwnedRoomResource } from "room_resource/room_resource/owned_room_resource"
import { V3BridgeDriverProcessApi } from "os_v5/processes/v3_os_bridge/v3_bridge_driver_process"


type Dependency = V3BridgeSpawnRequestProcessApi
  & CreepDistributorProcessApi
  & CreepTaskStateManagementProcessApi
  & V3BridgeDriverProcessApi


type CreepRoles = ""
// eslint-disable-next-line @typescript-eslint/ban-types
type CreepMemoryExtension = {}
type MyCreep = TaskDrivenCreep<CreepRoles, CreepMemoryExtension>
type MyCreepMemory = TaskDrivenCreepMemory<CreepRoles> & CreepMemoryExtension


const creepBody = CreepBody.createWithBodyParts([
  CARRY, CARRY, CARRY, CARRY, CARRY,
  CARRY, CARRY, CARRY, CARRY, CARRY,
  MOVE,
])

const defaultTrashableResources: ResourceConstant[] = [
  ...DepositConstant,
  ...MineralConstant,
]

type DrainableStructures = StructureTerminal | StructureStorage
type DisposeState = {
  readonly resourceType: ResourceConstant
  readonly storeId: Id<DrainableStructures>
}

type StoppedReasons = "manually" | "finished"

type DisposeResourceProcessState = {
  readonly r: RoomName
  readonly p?: RoomName
  readonly tr?: ResourceConstant[] /// undefined なら defaultTrashableResources
  readonly s: StoppedReasons[]
}

ProcessDecoder.register("DisposeResourceProcess", (processId: DisposeResourceProcessId, state: DisposeResourceProcessState) => DisposeResourceProcess.decode(processId, state))

export type DisposeResourceProcessId = ProcessId<Dependency, RoomName, void, DisposeResourceProcessState, DisposeResourceProcess>


export class DisposeResourceProcess extends Process<Dependency, RoomName, void, DisposeResourceProcessState, DisposeResourceProcess> {
  public readonly identifier: RoomName
  public readonly dependencies: ProcessDependencies = {
    processes: [
      { processType: "V3BridgeDriverProcess", identifier: processDefaultIdentifier },
      { processType: "V3BridgeSpawnRequestProcess", identifier: processDefaultIdentifier },
      { processType: "CreepDistributorProcess", identifier: processDefaultIdentifier },
      { processType: "CreepTaskStateManagementProcess", identifier: processDefaultIdentifier },
    ],
  }


  private readonly codename: string
  private disposeState: DisposeState | null = null


  private constructor(
    public readonly processId: DisposeResourceProcessId,
    public readonly roomName: RoomName,
    public readonly parentRoomName: RoomName,
    public readonly resourcesToTrash: ResourceConstant[] | undefined,
    public readonly stoppedReasons: StoppedReasons[],
  ) {
    super()
    this.identifier = roomName
    this.codename = SystemCalls.uniqueId.generateCodename("DisposeResourceProcess", parseInt(processId, 36))
  }

  public encode(): DisposeResourceProcessState {
    return {
      r: this.roomName,
      p: this.parentRoomName === this.roomName ? undefined : this.parentRoomName,
      tr: this.resourcesToTrash,
      s: this.stoppedReasons,
    }
  }

  public static decode(processId: DisposeResourceProcessId, state: DisposeResourceProcessState): DisposeResourceProcess {
    return new DisposeResourceProcess(processId, state.r, state.p ?? state.r, state.tr, state.s ?? [])
  }

  public static create(processId: DisposeResourceProcessId, room: MyRoom, parentRoom: MyRoom): DisposeResourceProcess {
    return new DisposeResourceProcess(processId, room.name, parentRoom.name, undefined, [])
  }

  public getDependentData(sharedMemory: ReadonlySharedMemory): Dependency | null {
    return this.getFlatDependentData(sharedMemory)
  }
  public staticDescription(): string {
    return `${ConsoleUtility.roomLink(this.parentRoomName)} => ${ConsoleUtility.roomLink(this.roomName)}`
  }

  public runtimeDescription(): string {
    return this.staticDescription()
  }

  public run(dependency: Dependency): void {
    if (this.stoppedReasons.length > 0) {
      return
    }

    const creeps = dependency.getCreepsFor(this.processId)
    const creepsWithTask: MyCreep[] = dependency.registerTaskDrivenCreeps(creeps)

    if (creepsWithTask.length <= 0) {
      this.spawnCreep(dependency)
    }

    const roomResource = dependency.getOwnedRoomResource(this.roomName)
    if (roomResource == null) {
      return
    }

    if (this.disposeState == null) {
      this.disposeState = this.getDisposeTarget(roomResource)
      if (this.disposeState == null) {
        SystemCalls.logger.log(this, "Finish working")
        this.stoppedReasons.push("finished")

        creepsWithTask.forEach(creep => {
          creep.say("finished!")
          creep.suicide()
        })
        return
      }
    }
    const disposeState = this.disposeState

    creepsWithTask.forEach(creep => {
      if (creep.task == null) {
        creep.task = this.creepTaskFor(creep, disposeState)
      }
    })
  }

  // Private
  private spawnCreep(dependency: Dependency): void {
    const memory = dependency.createSpawnCreepMemoryFor<MyCreepMemory>(this.processId, { t: null, r: "" })
    dependency.addSpawnRequest(creepBody, this.parentRoomName, { codename: this.codename, memory })
  }

  private creepTaskFor(creep: MyCreep, disposeState: DisposeState): CreepTask.AnyTask | null {
    if (creep.room.name !== this.roomName) {
      return CreepTask.Tasks.MoveToRoom.create(this.roomName, [])
    }

    const target = Game.getObjectById(disposeState.storeId)
    if (target == null || target.store.getUsedCapacity(disposeState.resourceType) <= 0) {
      this.disposeState = null
      return null
    }

    const tasks: CreepTask.AnyTask[] = [
      CreepTask.Tasks.MoveTo.create(target.pos),
      CreepTask.Tasks.WithdrawResource.create(target.id, disposeState.resourceType),
      CreepTask.Tasks.DropResource.create(disposeState.resourceType),
    ]
    return CreepTask.Tasks.Sequential.create(tasks)
  }

  private getDisposeTarget(roomResource: OwnedRoomResource): DisposeState | null {
    const disposableResources = this.resourcesToTrash ?? defaultTrashableResources

    const targets: DrainableStructures[] = []
    if (roomResource.activeStructures.terminal != null) {
      targets.push(roomResource.activeStructures.terminal)
    }
    if (roomResource.activeStructures.storage != null) {
      targets.push(roomResource.activeStructures.storage)
    }

    for (const target of targets) {
      for (const resourceType of disposableResources) {
        if (target.store.getUsedCapacity(resourceType) > 0) {
          return {
            storeId: target.id,
            resourceType,
          }
        }
      }
    }
    return null
  }
}
